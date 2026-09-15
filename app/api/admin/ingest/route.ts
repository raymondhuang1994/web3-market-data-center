import bootstrap from '@/data/bootstrap.json';
import { archiveBundle } from '@/lib/archive';
import { readBundle } from '@/lib/bundles';
import { db } from '@/lib/db';
import { sha256, verifyIdentity, ingestUrl } from '@/lib/oidc';
import { keepLastGood, validateBundle } from '@/lib/snapshot';
import type { Bundle } from '@/lib/data';
import { editionTimes, enforceCutoff, hongKongDate } from '@/lib/edition';
import { hongKongCalendar } from '@/lib/calendar';
export async function POST(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return Response.json({ error: 'JSON required' }, { status: 415 });
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ') || authorization.length > 16400)
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (Number(request.headers.get('content-length')) > 8000000)
    return Response.json({ error: 'Payload too large' }, { status: 413 });
  let claims;
  try {
    claims = await verifyIdentity(authorization.slice(7));
  } catch (error) {
    console.warn(
      'OIDC rejected',
      error instanceof Error && error.message.startsWith('oidc_check_')
        ? error.message
        : error instanceof Error
          ? error.name
          : 'unknown',
    );
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let bytes: Uint8Array;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw Error();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8000000) {
        await reader.cancel();
        return Response.json({ error: 'Payload too large' }, { status: 413 });
      }
      chunks.push(value);
    }
    bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
  const hash = await sha256(bytes);
  if (claims.aud !== ingestUrl + '#sha256=' + hash)
    return Response.json({ error: 'Body digest mismatch' }, { status: 401 });
  let candidate: Bundle;
  try {
    candidate = validateBundle(
      JSON.parse(new TextDecoder().decode(bytes)),
      bootstrap as unknown as Bundle,
    );
    if (candidate.edition?.reportDate !== hongKongDate()) throw Error('Only today can be prepared');
    candidate.edition = { ...editionTimes(candidate.edition.reportDate), calendar: hongKongCalendar(candidate.edition.reportDate) };
  } catch {
    return Response.json(
      { error: 'Invalid dataset contract' },
      { status: 422 },
    );
  }
  try {
    const database = db();
    const previous = await database
      .prepare(
        'SELECT d.payload,s.generated_at,s.id FROM snapshots s JOIN datasets d ON d.snapshot_id=s.id WHERE s.id=(SELECT id FROM snapshots WHERE id IN (SELECT snapshot_id FROM current_snapshot UNION SELECT snapshot_id FROM daily_editions WHERE report_date=?) ORDER BY generated_at DESC LIMIT 1)',
      )
      .bind(candidate.edition!.reportDate)
      .all<{ payload: string; generated_at: string; id: string }>();
    const replay = await database
      .prepare('SELECT payload_hash,snapshot_id FROM ingest_tokens WHERE jti=?')
      .bind(claims.jti)
      .first<{ payload_hash: string; snapshot_id: string }>();
    if (replay) {
      if (replay.payload_hash !== hash)
        return Response.json({ error: 'Replay conflict' }, { status: 409 });
      const accepted = await readBundle(replay.snapshot_id);
      if (!accepted)
        return Response.json(
          { error: 'Accepted snapshot unavailable' },
          { status: 503 },
        );
      let archived = false;
      try {
        await archiveBundle(accepted, replay.snapshot_id);
        archived = true;
      } catch {
        console.warn('Snapshot archive retry failed');
      }
      return Response.json({
        accepted: true,
        snapshotId: replay.snapshot_id,
        idempotent: true,
        generatedAt: accepted.generatedAt,
        datasetCount: accepted.datasets.length,
        archived,
      });
    }
    if (
      previous.results.length &&
      Date.parse(candidate.generatedAt) <=
        Date.parse(previous.results[0].generated_at)
    )
      return Response.json({ error: 'Older batch rejected' }, { status: 409 });
    const bundle = keepLastGood(
      enforceCutoff(candidate, candidate.edition!.cutoffAt),
      enforceCutoff(
      previous.results.length
        ? {
            schemaVersion: 1,
            generatedAt: previous.results[0].generated_at,
            datasets: previous.results.map((r) => JSON.parse(r.payload)),
          }
        : (bootstrap as unknown as Bundle), candidate.edition!.cutoffAt),
    );
    if (!bundle.datasets.some((d) => d.rows.length)) return Response.json({ error: 'No eligible pre-cutoff data' }, { status: 422 });
    if (new TextEncoder().encode(JSON.stringify(bundle)).length > 8000000)
      return Response.json(
        { error: 'Merged snapshot too large' },
        { status: 422 },
      );
    const id = hash,
      received = new Date().toISOString();
    const statements = [
      database
        .prepare(
          'INSERT INTO ingest_tokens(jti,payload_hash,snapshot_id,accepted_at) VALUES(?,?,?,?)',
        )
        .bind(claims.jti, hash, id, received),
      database
        .prepare(
          'INSERT INTO snapshots(id,generated_at,received_at,run_id,payload_hash) VALUES(?,?,?,?,?)',
        )
        .bind(
          id,
          bundle.generatedAt,
          received,
          claims.run_id,
          hash,
        ),
    ];
    for (let start = 0; start < bundle.datasets.length; start += 15) {
      const part = bundle.datasets.slice(start, start + 15);
      statements.push(
        database
          .prepare(
            'INSERT INTO datasets(key,snapshot_id,dataset_id,payload) VALUES ' +
              part.map(() => '(?,?,?,?)').join(','),
          )
          .bind(
            ...part.flatMap((d) => [
              id + ':' + d.id,
              id,
              d.id,
              JSON.stringify(d),
            ]),
          ),
      );
    }
    statements.push(
      database
        .prepare(
          'INSERT INTO daily_editions(snapshot_id,report_date,cutoff_at,deadline_at,calendar_json) VALUES(?,?,?,?,?)',
        )
        .bind(id, bundle.edition!.reportDate, bundle.edition!.cutoffAt, bundle.edition!.deadlineAt, JSON.stringify(bundle.edition!.calendar)),
    );
    await database.batch(statements);
    let archived = false;
    try {
      await archiveBundle(bundle, id);
      archived = true;
    } catch {
      console.warn('Snapshot archive failed');
    }
    try {
      await database.batch([
        database.prepare(
          'DELETE FROM datasets WHERE snapshot_id IN (SELECT snapshot_id FROM snapshot_archives) AND snapshot_id NOT IN (SELECT id FROM snapshots ORDER BY generated_at DESC LIMIT 60) AND snapshot_id NOT IN (SELECT snapshot_id FROM current_snapshot)',
        ),
        database.prepare(
          'DELETE FROM snapshots WHERE id IN (SELECT snapshot_id FROM snapshot_archives) AND id NOT IN (SELECT id FROM snapshots ORDER BY generated_at DESC LIMIT 60) AND id NOT IN (SELECT snapshot_id FROM current_snapshot)',
        ),
        database.prepare(
          "DELETE FROM ingest_tokens WHERE accepted_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days')",
        ),
      ]);
    } catch {
      /* Cleanup is best effort. The current complete edition stays protected. */
    }
    return Response.json({
      accepted: true,
      staged: true,
      archived,
      snapshotId: id,
      runId: claims.run_id,
      datasetCount: bundle.datasets.length,
      generatedAt: bundle.generatedAt,
    });
  } catch {
    return Response.json(
      { error: 'Publish failed; previous snapshot retained' },
      { status: 503 },
    );
  }
}
