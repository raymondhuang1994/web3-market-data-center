import { db } from '@/lib/db';
import { reportStorage } from '@/lib/storage';
import { ingestUrl, sha256, verifyIdentity } from '@/lib/oidc';
export async function POST(request: Request) {
  const id = new URL(request.url).searchParams.get('snapshot');
  if (!id || !/^[a-f0-9]{64}$/.test(id))
    return Response.json({ error: 'Invalid snapshot' }, { status: 400 });
  if (request.headers.get('content-type') !== 'application/pdf')
    return Response.json({ error: 'PDF required' }, { status: 415 });
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ') || auth.length > 16400)
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const target = ingestUrl.replace('/ingest', '/report') + '?snapshot=' + id;
  let claims;
  try {
    claims = await verifyIdentity(auth.slice(7), target);
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const limit = 20 * 1024 * 1024;
  if (Number(request.headers.get('content-length')) > limit)
    return Response.json({ error: 'PDF too large' }, { status: 413 });
  let bytes: Uint8Array;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw Error();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        return Response.json({ error: 'PDF too large' }, { status: 413 });
      }
      chunks.push(value);
    }
    bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }
  const hash = await sha256(bytes);
  if (claims.aud !== target + '#sha256=' + hash)
    return Response.json({ error: 'Digest mismatch' }, { status: 401 });
  if (
    new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-' ||
    !new TextDecoder().decode(bytes.slice(-1024)).includes('%%EOF')
  )
    return Response.json({ error: 'Invalid PDF' }, { status: 422 });
  try {
    const database = db();
    const snapshot = await database
      .prepare('SELECT generated_at,run_id FROM snapshots WHERE id=?')
      .bind(id)
      .first<{ generated_at: string; run_id: string }>();
    if (!snapshot || snapshot.run_id !== claims.run_id)
      return Response.json(
        { error: 'Unknown snapshot or run' },
        { status: 409 },
      );
    const existing = await database
      .prepare('SELECT object_key,pdf_hash FROM reports WHERE snapshot_id=?')
      .bind(id)
      .first<{ object_key: string; pdf_hash: string }>();
    if (existing)
      return Response.json(
        { accepted: existing.pdf_hash === hash, snapshotId: id },
        { status: existing.pdf_hash === hash ? 200 : 409 },
      );
    const key = 'reports/' + id + '/' + hash + '.pdf';
    await reportStorage().put(key, bytes, {
      httpMetadata: { contentType: 'application/pdf' },
      customMetadata: { snapshotId: id, generatedAt: snapshot.generated_at },
    });
    await database.batch([
      database
        .prepare(
          'INSERT INTO ingest_tokens(jti,payload_hash,snapshot_id,accepted_at) VALUES(?,?,?,?)',
        )
        .bind(String(claims.jti), hash, id, new Date().toISOString()),
      database
        .prepare(
          'INSERT INTO reports(snapshot_id,object_key,pdf_hash,byte_count,data_generated_at,created_at,run_id) VALUES(?,?,?,?,?,?,?)',
        )
        .bind(
          id,
          key,
          hash,
          bytes.length,
          snapshot.generated_at,
          new Date().toISOString(),
          String(claims.run_id),
        ),
    ]);
    return Response.json({
      accepted: true,
      snapshotId: id,
      bytes: bytes.length,
    });
  } catch {
    return Response.json(
      { error: 'Report publication failed; previous report retained' },
      { status: 503 },
    );
  }
}
