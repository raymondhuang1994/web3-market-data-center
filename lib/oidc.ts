const issuer = 'https://token.actions.githubusercontent.com';
const jwksUrl = issuer + '/.well-known/jwks';
export const ingestUrl =
  'https://web3-market-center.raymondhuangj.chatgpt.site/api/admin/ingest';
const repo = 'raymondhuang1994/web3-market-data-center';
const repoId = '1370214885',
  ownerId = '209585471';
export type Claims = Record<string, unknown>;
function assert(value: unknown, code = 'oidc_rejected'): asserts value {
  if (!value) throw new Error(code);
}
export async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
function decode(value: string) {
  assert(/^[A-Za-z0-9_-]+$/.test(value), 'oidc_check_19');
  return Uint8Array.from(
    atob(value.replace(/-/g, '+').replace(/_/g, '/')),
    (x) => x.charCodeAt(0),
  );
}
export function checkClaims(
  c: Claims,
  hash: string,
  now = Math.floor(Date.now() / 1000),
  audienceBase = ingestUrl,
) {
  assert(
    c.iss === issuer && c.aud === audienceBase + '#sha256=' + hash,
    'oidc_check_30',
  );
  assert(
    c.repository === repo &&
      c.repository_id === repoId &&
      c.repository_owner_id === ownerId &&
      c.repository_owner === 'raymondhuang1994',
    'oidc_check_31',
  );
  assert(
    c.repository_visibility === 'private' &&
      c.ref === 'refs/heads/main' &&
      c.ref_type === 'branch',
    'oidc_check_37',
  );
  assert(
    c.workflow_ref ===
      repo + '/.github/workflows/update-data.yml@refs/heads/main',
    'oidc_check_42',
  );
  assert(
    c.event_name === 'schedule' || c.event_name === 'workflow_dispatch',
    'oidc_check_46',
  );
  assert(c.runner_environment === 'github-hosted', 'oidc_check_47');
  const allowed = [
    `repo:raymondhuang1994@${ownerId}/web3-market-data-center@${repoId}:ref:refs/heads/main`,
    `repo:${repo}:ref:refs/heads/main`,
  ];
  assert(allowed.includes(String(c.sub)), 'oidc_check_52');
  for (const k of ['iat', 'exp', 'nbf'])
    assert(typeof c[k] === 'number' && Number.isInteger(c[k]), 'oidc_check_54');
  const iat = c.iat as number,
    exp = c.exp as number,
    nbf = c.nbf as number;
  assert(
    exp > now - 30 &&
      iat <= now + 30 &&
      nbf <= now + 30 &&
      iat >= now - 630 &&
      exp > iat,
    'oidc_check_58',
  );
  assert(
    typeof c.jti === 'string' && c.jti.length > 0 && c.jti.length < 256,
    'oidc_check_65',
  );
  for (const k of ['run_id', 'run_attempt', 'run_number'])
    assert(
      typeof c[k] === 'string' && /^\d+$/.test(c[k] as string),
      'oidc_check_67',
    );
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
    assert(cache && now < cache.until, 'oidc_check_78');
    return cache.keys;
  }
  lastFetch = now;
  fetching = (async () => {
    const r = await fetch(jwksUrl, {
      signal: AbortSignal.timeout(10000),
      redirect: 'manual',
    });
    assert(r.ok, 'oidc_check_87');
    const text = await r.text();
    assert(text.length < 100000, 'oidc_check_89');
    const parsed = JSON.parse(text);
    assert(
      Array.isArray(parsed.keys) && parsed.keys.length < 30,
      'oidc_check_91',
    );
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
  audienceBase = ingestUrl,
) {
  assert(token.length <= 16384, 'oidc_check_107');
  const parts = token.split('.');
  assert(parts.length === 3, 'oidc_check_109');
  const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  assert(
    header && typeof header === 'object' && !Array.isArray(header),
    'oidc_check_111',
  );
  assert(
    header.alg === 'RS256' &&
      typeof header.kid === 'string' &&
      header.kid.length < 200,
    'oidc_check_112',
  );
  for (const key of ['jku', 'x5u', 'jwk', 'crit', 'b64'])
    assert(!(key in header), 'oidc_check_118');
  const jwk = keys.find(
    (k) => (k as JsonWebKey & { kid: string }).kid === header.kid,
  );
  assert(
    jwk?.kty === 'RSA' &&
      (!jwk.alg || jwk.alg === 'RS256') &&
      (!jwk.use || jwk.use === 'sig') &&
      (!jwk.key_ops || jwk.key_ops.includes('verify')),
    'oidc_check_122',
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
    'oidc_check_135',
  );
  const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  assert(
    claims && typeof claims === 'object' && !Array.isArray(claims),
    'oidc_check_144',
  );
  return checkClaims(claims, hash, now, audienceBase);
}
export async function verifyGitHub(
  token: string,
  hash: string,
  audienceBase = ingestUrl,
) {
  let keys = await trustedKeys();
  try {
    return await verifySignedToken(token, keys, hash, undefined, audienceBase);
  } catch {
    keys = await trustedKeys(true);
    return verifySignedToken(token, keys, hash, undefined, audienceBase);
  }
}

export async function verifyIdentity(token: string, audienceBase = ingestUrl) {
  assert(token.length <= 16384, 'oidc_check_158');
  const parts = token.split('.');
  assert(parts.length === 3, 'oidc_check_160');
  const decoded = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  assert(typeof decoded.aud === 'string', 'oidc_check_162');
  const prefix = audienceBase + '#sha256=';
  assert(decoded.aud.startsWith(prefix), 'oidc_check_164');
  const hash = decoded.aud.slice(prefix.length);
  assert(/^[a-f0-9]{64}$/.test(hash), 'oidc_check_166');
  return verifyGitHub(token, hash, audienceBase);
}
