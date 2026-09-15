import bootstrap from '@/data/bootstrap.json';
import type { Bundle } from './data';
import { reportStorage } from './storage';
import { db } from './db';
async function withEdition(bundle: Bundle): Promise<Bundle> {
  const row = await db()
    .prepare(
      'SELECT report_date,cutoff_at,deadline_at,calendar_json,analysis_json,analysis_hash,published_at FROM daily_editions WHERE snapshot_id=?',
    )
    .bind(bundle.snapshotId)
    .first<{
      report_date: string;
      cutoff_at: string;
      deadline_at: string;
      calendar_json: string;
      analysis_json: string | null;
      analysis_hash: string | null;
      published_at: string | null;
    }>();
  if (!row) return bundle;
  return {
    ...bundle,
    delivery: row.published_at ? 'live' : 'staged',
    edition: {
      reportDate: row.report_date,
      cutoffAt: row.cutoff_at,
      deadlineAt: row.deadline_at,
      timezone: 'Asia/Hong_Kong',
      calendar: JSON.parse(row.calendar_json),
      analysisHash: row.analysis_hash,
      publishedAt: row.published_at,
    },
    ...(row.analysis_json ? { analysis: JSON.parse(row.analysis_json) } : {}),
  };
}
export async function readBundle(snapshotId?: string): Promise<Bundle | null> {
  try {
    const q = snapshotId
      ? db()
          .prepare(
            'SELECT d.payload,s.generated_at,s.id FROM snapshots s JOIN datasets d ON d.snapshot_id=s.id WHERE s.id=? ORDER BY d.dataset_id',
          )
          .bind(snapshotId)
      : db().prepare(
          'SELECT d.payload,s.generated_at,s.id FROM current_snapshot c JOIN snapshots s ON c.snapshot_id=s.id JOIN datasets d ON d.snapshot_id=s.id WHERE c.id=1 ORDER BY d.dataset_id',
        );
    const rows = await q.all<{
      payload: string;
      generated_at: string;
      id: string;
    }>();
    if (rows.results.length)
      return await withEdition({
        schemaVersion: 1,
        generatedAt: rows.results[0].generated_at,
        snapshotId: rows.results[0].id,
        delivery: 'live',
        datasets: rows.results.map((r) => JSON.parse(r.payload)),
      });
  } catch {
    /* Show explicit fallback state; never label this as a healthy live read. */
  }
  if (snapshotId) {
    try {
      const archive = await reportStorage().get(
        'snapshots/' + snapshotId + '.json',
      );
      if (archive) return await withEdition(await archive.json<Bundle>());
    } catch {}
    return null;
  }
  return {
    ...(bootstrap as unknown as Bundle),
    delivery: 'bootstrap',
    snapshotId: 'bootstrap',
  };
}

export async function readDraft(date: string) {
  const row = await db()
    .prepare(
      'SELECT e.snapshot_id FROM daily_editions e JOIN snapshots s ON s.id=e.snapshot_id WHERE e.report_date=? ORDER BY (e.published_at IS NOT NULL) DESC,(e.analysis_json IS NOT NULL) DESC,s.generated_at DESC LIMIT 1',
    )
    .bind(date)
    .first<{ snapshot_id: string }>();
  return row ? readBundle(row.snapshot_id) : null;
}
