import bootstrap from '@/data/bootstrap.json';
import { db } from '@/lib/db';
export async function GET() {
  try {
    const rows = await db()
      .prepare(
        'SELECT d.payload, s.generated_at FROM current_snapshot c JOIN snapshots s ON c.snapshot_id = s.id JOIN datasets d ON d.snapshot_id = s.id WHERE c.id = 1 ORDER BY d.dataset_id',
      )
      .all<{ payload: string; generated_at: string }>();
    if (rows.results.length)
      return Response.json(
        {
          schemaVersion: 1,
          generatedAt: rows.results[0].generated_at,
          datasets: rows.results.map((r) => JSON.parse(r.payload)),
          delivery: 'live',
        },
        { headers: { 'Cache-Control': 'public, max-age=60' } },
      );
  } catch {
    /* A failed read never removes the initial verified snapshot. */
  }
  return Response.json(
    { ...bootstrap, delivery: 'bootstrap' },
    { headers: { 'Cache-Control': 'public, max-age=60' } },
  );
}
