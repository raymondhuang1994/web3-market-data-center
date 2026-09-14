const issuer = 'https://token.actions.githubusercontent.com';
const jwksUrl = issuer + '/.well-known/jwks';
export const ingestUrl =
  'https://web3-market-center.raymondhuangj.chatgpt.site/api/admin/ingest';
const repo = 'raymondhuang1994/web3-market-data-center';
const repoId = '1370214885',
  ownerId = '209585471';
export type Claims = Record<string, unknown>;
function assert(value: unknown): asserts value {
  if (!value) throw new Error('Unauthorized');
}
export async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
function decode(value: string) {
  assert(/^[A-Za-z0-9_-]+$/.test(value));
  return Uint8Array.from(
    atob(value.replace(/-/g, '+').replace(/_/g, '/')),
    (x) => x.charCodeAt(0),
  );
}
export function checkClaims(
  c: Claims,
  hash: string,
  now = Math.floor(Date.now() / 1000),
) {
  assert(c.iss === issuer && c.aud === ingestUrl + '#sha256=' + hash);
  assert(
    c.repository === repo &&
      c.repository_id === repoId &&
      c.repository_owner_id === ownerId &&
      c.repository_owner === 'raymondhuang1994',
  );
  assert(
    c.repository_visibility === 'private' &&
      c.ref === 'refs/heads/main' &&
      c.ref_type === 'branch',
  );
  assert(
    c.workflow_ref ===
      repo + '/.github/workflows/update-data.yml@refs/heads/main',
  );
  assert(c.event_name === 'schedule' || c.event_name === 'workflow_dispatch');
  assert(c.runner_environment === 'github-hosted');
  const allowed = [
    `repo:raymondhuang1994@${ownerId}/web3-market-data-center@${repoId}:ref:refs/heads/main`,
    `repo:${repo}:ref:refs/heads/main`,
  ];
  assert(allowed.includes(String(c.sub)));
  for (const k of ['iat', 'exp', 'nbf'])
    assert(typeof c[k] === 'number' && Number.isInteger(c[k]));
  const iat = c.iat as number,
    exp = c.exp as number,
    nbf = c.nbf as number;
  assert(
    exp > now - 30 &&
      iat <= now + 30 &&
      nbf <= now + 30 &&
      iat >= now - 630 &&
      exp > iat,
  );
  assert(typeof c.jti === 'string' && c.jti.length > 0 && c.jti.length < 256);
  for (const k of ['run_id', 'run_attempt', 'run_number'])
    assert(typeof c[k] === 'string' && /^\d+$/.test(c[k] as string));
  return c;
}
let cache: { keys: JsonWebKey[]; until: number } | null = null;
let lastFetch = 0;
let fetching: Promise<JsonWebKey[]> | null = null;
async function trustedKeys(refresh = false): Promise<JsonWebKey[]> {
  const now = Date.now();
  if (cache && now < cache.until && !refresh) return cache.keys;
  if (fetching) return fetching;
  if (now - lastFetch < 30000) {
    assert(cache && now < cache.until);
    return cache.keys;
  }
  lastFetch = now;
  fetching = (async () => {
    const r = await fetch(jwksUrl, {
      signal: AbortSignal.timeout(10000),
      redirect: 'error',
    });
    assert(r.ok);
    const text = await r.text();
    assert(text.length < 100000);
    const parsed = JSON.parse(text);
    assert(Array.isArray(parsed.keys) && parsed.keys.length < 30);
    cache = { keys: parsed.keys, until: now + 3600000 };
    return cache.keys;
  })();
  try {
    return await fetching;
  } finally {
    fetching = null;
  }
}
export async function verifySignedToken(
  token: string,
  keys: JsonWebKey[],
  hash: string,
  now?: number,
) {
  assert(token.length <= 16384);
  const parts = token.split('.');
  assert(parts.length === 3);
  const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  assert(header && typeof header === 'object' && !Array.isArray(header));
  assert(
    header.alg === 'RS256' &&
      typeof header.kid === 'string' &&
      header.kid.length < 200,
  );
  for (const key of ['jku', 'x5u', 'jwk', 'crit', 'b64'])
    assert(!(key in header));
  const jwk = keys.find(
    (k) => (k as JsonWebKey & { kid: string }).kid === header.kid,
  );
  assert(
    jwk?.kty === 'RSA' &&
      (!jwk.alg || jwk.alg === 'RS256') &&
      (!jwk.use || jwk.use === 'sig') &&
      (!jwk.key_ops || jwk.key_ops.includes('verify')),
  );
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  assert(
    await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decode(parts[2]) as BufferSource,
      new TextEncoder().encode(parts[0] + '.' + parts[1]),
    ),
  );
  const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  assert(claims && typeof claims === 'object' && !Array.isArray(claims));
  return checkClaims(claims, hash, now);
}
export async function verifyGitHub(token: string, hash: string) {
  let keys = await trustedKeys();
  try {
    return await verifySignedToken(token, keys, hash);
  } catch {
    keys = await trustedKeys(true);
    return verifySignedToken(token, keys, hash);
  }
}

export async function verifyIdentity(token: string) {
  assert(token.length <= 16384);
  const parts = token.split('.');
  assert(parts.length === 3);
  const decoded = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  assert(typeof decoded.aud === 'string');
  const prefix = ingestUrl + '#sha256=';
  assert(decoded.aud.startsWith(prefix));
  const hash = decoded.aud.slice(prefix.length);
  assert(/^[a-f0-9]{64}$/.test(hash));
  return verifyGitHub(token, hash);
}
