import type { Bundle } from './data';
import { db } from './db';
import { reportStorage } from './storage';
export async function archiveBundle(bundle: Bundle, id: string) {
  await reportStorage().put(
    'snapshots/' + id + '.json',
    JSON.stringify({ ...bundle, snapshotId: id, delivery: bundle.edition?.publishedAt ? 'live' : 'staged' }),
    { httpMetadata: { contentType: 'application/json' } },
  );
  await db()
    .prepare(
      'INSERT OR IGNORE INTO snapshot_archives(snapshot_id,archived_at) VALUES(?,?)',
    )
    .bind(id, new Date().toISOString())
    .run();
}
