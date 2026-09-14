import { readBundle } from '@/lib/bundles';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const snapshot = url.searchParams.get('snapshot') || undefined;
  if (snapshot && !/^[a-f0-9]{64}$/.test(snapshot))
    return Response.json({ error: 'Invalid snapshot' }, { status: 400 });
  const bundle = await readBundle(snapshot);
  if (!bundle)
    return Response.json({ error: 'Snapshot unavailable' }, { status: 404 });
  const ids = url.searchParams.get('ids')?.split(',').filter(Boolean);
  if (ids && (ids.length > 80 || ids.some((id) => !/^[a-z0-9_]+$/.test(id))))
    return Response.json({ error: 'Invalid datasets' }, { status: 400 });
  return Response.json(
    {
      ...bundle,
      datasetCount: bundle.datasets.length,
      withRows: bundle.datasets.filter((d) => d.rows.length).length,
      datasets: ids
        ? bundle.datasets.filter((d) => ids.includes(d.id))
        : bundle.datasets,
    },
    {
      headers: {
        'Cache-Control':
          bundle.delivery === 'live' ? 'public, max-age=60' : 'no-store',
      },
    },
  );
}
