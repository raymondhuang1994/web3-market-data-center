import { env } from 'cloudflare:workers';
import { db } from '@/lib/db';
import { readBundle, readDraft } from '@/lib/bundles';
import { freezeAnalysis } from '@/lib/analysis-publish';
import { BigModelError, generateBigModelAnalysis } from '@/lib/bigmodel';
import { ingestUrl, sha256, verifyIdentity } from '@/lib/oidc';

export async function POST(request: Request) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ') || auth.length > 16400)
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return Response.json({ error: 'JSON required' }, { status: 415 });
  const target = ingestUrl.replace('/ingest', '/analysis/generate');
  let claims;
  try {
    claims = await verifyIdentity(auth.slice(7), target);
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const reader = request.body?.getReader();
  if (!reader)
    return Response.json({ error: 'Body required' }, { status: 400 });
  let text = '';
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    if (text.length > 1000) {
      await reader.cancel();
      return Response.json({ error: 'Too large' }, { status: 413 });
    }
  }
  text += decoder.decode();
  const hash = await sha256(new TextEncoder().encode(text));
  if (claims.aud !== target + '#sha256=' + hash)
    return Response.json({ error: 'Digest mismatch' }, { status: 401 });
  try {
    const input = JSON.parse(text);
    if (
      typeof input.snapshotId !== 'string' ||
      !/^[a-f0-9]{64}$/.test(input.snapshotId)
    )
      return Response.json({ error: 'Invalid snapshot' }, { status: 400 });
    const bundle = await readBundle(input.snapshotId);
    if (!bundle?.edition || Date.now() < Date.parse(bundle.edition.cutoffAt))
      return Response.json(
        { error: 'Cutoff not reached or draft unavailable' },
        { status: 409 },
      );
    const selected = await readDraft(bundle.edition.reportDate);
    if (selected?.snapshotId !== bundle.snapshotId)
      return Response.json({ error: 'Superseded draft' }, { status: 409 });
    if (bundle.edition.publishedAt)
      return Response.json({
        accepted: true,
        published: true,
        snapshotId: bundle.snapshotId,
        generatedAt: bundle.generatedAt,
        reportDate: bundle.edition.reportDate,
        analysisHash: bundle.edition.analysisHash,
      });
    // Reuse frozen text verbatim on retries and claim the current finalizer run.
    const analysis =
      bundle.analysis ||
      (await generateBigModelAnalysis(
        bundle,
        (env as unknown as { BIGMODEL_API_KEY?: string }).BIGMODEL_API_KEY ||
          '',
      ));
    return await freezeAnalysis(bundle, analysis, claims, hash, db());
  } catch (error) {
    if (error instanceof BigModelError)
      return Response.json(
        { error: error.code, previousEditionRetained: true },
        { status: error.retryable ? 503 : 422 },
      );
    console.warn('Automatic analysis failed; previous edition retained');
    return Response.json(
      { error: 'Analysis unavailable; previous edition retained' },
      { status: 503 },
    );
  }
}
