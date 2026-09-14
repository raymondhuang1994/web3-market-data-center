import bootstrap from '@/data/bootstrap.json';
import { db } from '@/lib/db';
import { sha256, verifyIdentity, ingestUrl } from '@/lib/oidc';
import { keepLastGood, validateBundle } from '@/lib/snapshot';
import type { Bundle } from '@/lib/data';
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
  } catch {
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
        'SELECT d.payload, s.generated_at, s.id FROM current_snapshot c JOIN snapshots s ON c.snapshot_id=s.id JOIN datasets d ON d.snapshot_id=s.id WHERE c.id=1',
      )
      .all<{ payload: string; generated_at: string; id: string }>();
    const replay = await database
      .prepare('SELECT payload_hash,snapshot_id FROM ingest_tokens WHERE jti=?')
      .bind(claims.jti)
      .first<{ payload_hash: string; snapshot_id: string }>();
    if (replay)
      return Response.json(
        replay.payload_hash === hash
          ? { accepted: true, snapshotId: replay.snapshot_id, idempotent: true }
          : { error: 'Replay conflict' },
        { status: replay.payload_hash === hash ? 200 : 409 },
      );
    if (
      previous.results.length &&
      Date.parse(candidate.generatedAt) <=
        Date.parse(previous.results[0].generated_at)
    )
      return Response.json({ error: 'Older batch rejected' }, { status: 409 });
    const bundle = keepLastGood(
      candidate,
      previous.results.length
        ? {
            schemaVersion: 1,
            generatedAt: previous.results[0].generated_at,
            datasets: previous.results.map((r) => JSON.parse(r.payload)),
          }
        : (bootstrap as unknown as Bundle),
    );
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
          "INSERT INTO snapshots(id,generated_at,received_at,run_id,payload_hash) VALUES(?,(SELECT ? WHERE COALESCE((SELECT snapshot_id FROM current_snapshot WHERE id=1),'')=?),?,?,?)",
        )
        .bind(
          id,
          bundle.generatedAt,
          previous.results[0]?.id || '',
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
          'INSERT INTO current_snapshot(id,snapshot_id,generated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET snapshot_id=excluded.snapshot_id,generated_at=excluded.generated_at',
        )
        .bind(id, bundle.generatedAt),
    );
    await database.batch(statements);
    try {
      await database.batch([
        database.prepare(
          'DELETE FROM datasets WHERE snapshot_id NOT IN (SELECT id FROM snapshots ORDER BY generated_at DESC LIMIT 3) AND snapshot_id NOT IN (SELECT snapshot_id FROM current_snapshot)',
        ),
        database.prepare(
          'DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY generated_at DESC LIMIT 3) AND id NOT IN (SELECT snapshot_id FROM current_snapshot)',
        ),
        database.prepare(
          "DELETE FROM ingest_tokens WHERE accepted_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days')",
        ),
      ]);
    } catch {
      /* Cleanup is best effort after the atomic publication succeeded. */
    }
    return Response.json({
      accepted: true,
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
