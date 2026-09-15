import type { Bundle } from './data';
import type { Analysis } from './analysis';
import { sha256, type Claims } from './oidc.ts';

// Shared by explicit Codex submissions and server-side BigModel generation.
export async function freezeAnalysis(
  bundle: Bundle,
  analysis: Analysis,
  claims: Claims,
  bodyHash: string,
  database: D1Database,
) {
  if (!bundle.edition) throw new Error('Missing edition');
  const payload = JSON.stringify(analysis),
    hash = await sha256(new TextEncoder().encode(payload));
  if (bundle.edition.analysisHash && bundle.edition.analysisHash !== hash)
    return Response.json({ error: 'Analysis already frozen' }, { status: 409 });
  const replay = await database
    .prepare('SELECT payload_hash FROM ingest_tokens WHERE jti=?')
    .bind(claims.jti)
    .first<{ payload_hash: string }>();
  if (replay && replay.payload_hash !== bodyHash)
    return Response.json({ error: 'Replay conflict' }, { status: 409 });
  if (!replay && !bundle.edition.publishedAt) {
    const result = await database.batch([
      database
        .prepare(
          'INSERT INTO ingest_tokens(jti,payload_hash,snapshot_id,accepted_at) VALUES(?,?,?,?)',
        )
        .bind(
          claims.jti,
          bodyHash,
          bundle.snapshotId,
          new Date().toISOString(),
        ),
      database
        .prepare(
          'UPDATE daily_editions SET analysis_json=?,analysis_hash=?,finalizer_run_id=? WHERE snapshot_id=? AND published_at IS NULL AND (analysis_hash IS NULL OR analysis_hash=?) AND (finalizer_run_id IS NULL OR CAST(finalizer_run_id AS INTEGER)<=CAST(? AS INTEGER))',
        )
        .bind(
          payload,
          hash,
          String(claims.run_id),
          bundle.snapshotId,
          hash,
          String(claims.run_id),
        ),
    ]);
    if (!result[1].meta.changes)
      return Response.json({ error: 'Superseded finalizer' }, { status: 409 });
  }
  const accepted = await database
    .prepare(
      'SELECT analysis_hash,finalizer_run_id,published_at FROM daily_editions WHERE snapshot_id=?',
    )
    .bind(bundle.snapshotId)
    .first<{
      analysis_hash: string | null;
      finalizer_run_id: string | null;
      published_at: string | null;
    }>();
  if (
    !accepted ||
    accepted.analysis_hash !== hash ||
    (!accepted.published_at &&
      accepted.finalizer_run_id !== String(claims.run_id))
  )
    return Response.json({ error: 'Superseded finalizer' }, { status: 409 });
  return Response.json({
    accepted: true,
    snapshotId: bundle.snapshotId,
    generatedAt: bundle.generatedAt,
    analysisHash: hash,
    reportDate: bundle.edition.reportDate,
    published: !!accepted.published_at,
  });
}
