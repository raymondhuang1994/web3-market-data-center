import { freezeAnalysis } from '@/lib/analysis-publish';
import { db } from '@/lib/db';
import { readBundle, readDraft } from '@/lib/bundles';
import { validateAnalysis } from '@/lib/analysis';
import { sha256, verifyIdentity, ingestUrl } from '@/lib/oidc';
export async function POST(request: Request) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ') || auth.length > 16400)
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return Response.json({ error: 'JSON required' }, { status: 415 });
  const target = ingestUrl.replace('/ingest', '/analysis');
  let claims;
  try {
    claims = await verifyIdentity(auth.slice(7), target);
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const reader = request.body?.getReader();
  if (!reader)
    return Response.json({ error: 'Body required' }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 64000) {
      await reader.cancel();
      return Response.json({ error: 'Too large' }, { status: 413 });
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const part of chunks) {
    bytes.set(part, at);
    at += part.length;
  }
  const bodyHash = await sha256(bytes);
  if (claims.aud !== target + '#sha256=' + bodyHash)
    return Response.json({ error: 'Digest mismatch' }, { status: 401 });
  try {
    const input = JSON.parse(new TextDecoder().decode(bytes));
    if (!/^[a-f0-9]{64}$/.test(input.snapshotId))
      throw Error('Invalid snapshot');
    const bundle = await readBundle(input.snapshotId);
    if (!bundle?.edition || Date.now() < Date.parse(bundle.edition.cutoffAt))
      throw Error('Cutoff not reached');
    const selected = await readDraft(bundle.edition.reportDate);
    if (selected?.snapshotId !== bundle.snapshotId)
      throw Error('Superseded draft');
    const analysis = await validateAnalysis(input, bundle);
    return await freezeAnalysis(bundle, analysis, claims, bodyHash, db());
  } catch (e) {
    console.warn(
      'Analysis validation failed',
      e instanceof Error ? e.message : 'unknown',
    );
    return Response.json(
      { error: 'Analysis validation failed; previous edition retained' },
      { status: 422 },
    );
  }
}
