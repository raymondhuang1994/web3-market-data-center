import bootstrap from '@/data/bootstrap.json';
import type { Bundle } from './data';
import { reportStorage } from './storage';
import { db } from './db';
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
      return {
        schemaVersion: 1,
        generatedAt: rows.results[0].generated_at,
        snapshotId: rows.results[0].id,
        delivery: 'live',
        datasets: rows.results.map((r) => JSON.parse(r.payload)),
      };
  } catch {
    /* Show explicit fallback state; never label this as a healthy live read. */
  }
  if (snapshotId) {
    try {
      const archive = await reportStorage().get(
        'snapshots/' + snapshotId + '.json',
      );
      if (archive) return await archive.json<Bundle>();
    } catch {}
    return null;
  }
  return {
    ...(bootstrap as unknown as Bundle),
    delivery: 'bootstrap',
    snapshotId: 'bootstrap',
  };
}
