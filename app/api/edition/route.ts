import { readDraft } from '@/lib/bundles';
import { analysisFacts, factsDigest } from '@/lib/analysis';
import { editionTimes, hongKongDate } from '@/lib/edition';
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get('date') || hongKongDate();
  try {
    editionTimes(date);
  } catch {
    return Response.json({ error: 'Invalid date' }, { status: 400 });
  }
  try {
    const bundle = await readDraft(date);
    if (!bundle)
      return Response.json(
        { status: 'waiting-for-data', ...editionTimes(date) },
        { status: 202, headers: { 'Cache-Control': 'no-store' } },
      );
    const facts = analysisFacts(bundle);
    return Response.json(
      {
        status: bundle.edition?.publishedAt
          ? 'published'
          : bundle.analysis
            ? 'preparing-pdf'
            : Date.now() < Date.parse(bundle.edition!.cutoffAt)
              ? 'collecting'
              : 'awaiting-analysis',
        snapshotId: bundle.snapshotId,
        generatedAt: bundle.generatedAt,
        edition: bundle.edition,
        facts,
        factsHash: await factsDigest(facts),
        datasetCount: bundle.datasets.length,
        withRows: bundle.datasets.filter((d) => d.rows.length).length,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { error: 'Edition service unavailable' },
      { status: 503 },
    );
  }
}
