// Read-only regression probes for root integration. No network or Site writes.
// Run with Node >=22.13 (Node 24 supports these direct TypeScript imports).
// Intentionally failing tests record contracts the current implementation lacks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const { validateBundle, keepLastGood } = await import(
  pathToFileURL(root + '/lib/snapshot.ts')
);
const { checkClaims, verifySignedToken, ingestUrl } = await import(
  pathToFileURL(root + '/lib/oidc.ts')
);
const baseline = JSON.parse(
  await readFile(root + '/data/bootstrap.json', 'utf8'),
);
const now = Date.now();
function candidate() {
  const b = structuredClone(baseline);
  b.generatedAt = new Date(now).toISOString();
  return b;
}
function selected(b) {
  return b.datasets.find((d) => d.id === 'cex_spot_daily');
}
test('valid current bootstrap shape is accepted', () => {
  assert.doesNotThrow(() => validateBundle(candidate(), baseline, now));
});
test('contract rejects an object as source.name before React consumes it', () => {
  const b = candidate();
  selected(b).source.name = { unexpected: 'object' };
  assert.throws(() => validateBundle(b, baseline, now));
});
test('contract rejects non-string measures used by chart/selector methods', () => {
  const b = candidate();
  b.datasets.find((d) => d.id === 'stablecoin_marketcap').measures = [123];
  assert.throws(() => validateBundle(b, baseline, now));
});
test('contract rejects a numeric asOf before the UI calls slice()', () => {
  const b = candidate();
  selected(b).asOf = 2025;
  assert.throws(() => validateBundle(b, baseline, now));
});
test('contract rejects rows missing required day dimensions and all measures', () => {
  const b = candidate();
  selected(b).rows = [{}];
  assert.throws(() => validateBundle(b, baseline, now));
});
test('uploader cannot remove required dimensions to make an empty row valid', () => {
  const b = candidate();
  selected(b).dimensions = [];
  selected(b).measures = [];
  selected(b).rows = [{}];
  assert.throws(() => validateBundle(b, baseline, now));
});
test('an unreviewed rate dataset cannot promote itself to ready through ingestion', () => {
  const b = candidate();
  const d = b.datasets.find((d) => d.id === 'funding_oi_btc');
  d.status = 'ready';
  let rejected = false;
  try {
    validateBundle(b, baseline, now);
  } catch {
    rejected = true;
  }
  if (!rejected)
    assert.equal(
      d.status,
      'review',
      'source interpretation approval is controlled by the server contract',
    );
});
test('accepted generatedAt has a canonical UTC representation for DB text ordering', () => {
  const b = candidate();
  b.generatedAt = '2026-09-15T08:00:00+08:00';
  const validated = validateBundle(b, baseline, Date.parse('2026-09-15T01:00:00Z'));
  assert.equal(validated.generatedAt, '2026-09-15T00:00:00.000Z');
});
test('a dated ready dataset must not overwrite last-good using undated replacement rows', () => {
  const b = candidate();
  selected(b).asOf = null;
  selected(b).rows = [{ date: '2026-09-01', ALL: 1 }];
  let rejected = false;
  try {
    validateBundle(b, baseline, now);
  } catch {
    rejected = true;
  }
  if (!rejected) {
    const merged = keepLastGood(b, baseline);
    assert.equal(
      selected(merged).rows.length,
      selected(baseline).rows.length,
      'undated source must not replace dated historical rows',
    );
  }
});
const hash = 'a'.repeat(64),
  sec = Math.floor(now / 1000);
function claims() {
  return {
    iss: 'https://token.actions.githubusercontent.com',
    aud: ingestUrl + '#sha256=' + hash,
    repository: 'raymondhuang1994/web3-market-data-center',
    repository_id: '1370214885',
    repository_owner_id: '209585471',
    repository_owner: 'raymondhuang1994',
    repository_visibility: 'private',
    ref: 'refs/heads/main',
    ref_type: 'branch',
    workflow_ref:
      'raymondhuang1994/web3-market-data-center/.github/workflows/update-data.yml@refs/heads/main',
    event_name: 'schedule',
    runner_environment: 'github-hosted',
    sub: 'repo:raymondhuang1994@209585471/web3-market-data-center@1370214885:ref:refs/heads/main',
    iat: sec,
    nbf: sec,
    exp: sec + 300,
    jti: 'test-local-jti',
    run_id: '1',
    run_attempt: '1',
    run_number: '1',
  };
}
test('OIDC positive claims and independent negative claim mutations', () => {
  assert.doesNotThrow(() => checkClaims(claims(), hash, sec));
  const mutations = [
    { aud: ingestUrl },
    { repository_id: '999' },
    { repository_visibility: 'public' },
    { ref: 'refs/heads/other' },
    { event_name: 'pull_request_target' },
    { event_name: 'pull_request' },
    {
      workflow_ref:
        'raymondhuang1994/web3-market-data-center/.github/workflows/other.yml@refs/heads/main',
    },
    { exp: sec - 31 },
    { iat: sec - 631 },
    { nbf: sec + 31 },
    { sub: 'repo:any/other:ref:refs/heads/main' },
  ];
  for (const change of mutations)
    assert.throws(
      () => checkClaims({ ...claims(), ...change }, hash, sec),
      JSON.stringify(change),
    );
});
test('OIDC signature verification rejects altered payload and algorithm substitution', async () => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  jwk.kid = 'local-test';
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  const enc = (x) =>
    Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString(
      'base64url',
    );
  const header = enc({ alg: 'RS256', kid: 'local-test' }),
    payload = enc(claims()),
    unsigned = header + '.' + payload;
  const signature = Buffer.from(
    await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      keyPair.privateKey,
      new TextEncoder().encode(unsigned),
    ),
  ).toString('base64url');
  await assert.doesNotReject(() =>
    verifySignedToken(unsigned + '.' + signature, [jwk], hash, sec),
  );
  await assert.rejects(() =>
    verifySignedToken(
      header +
        '.' +
        enc({ ...claims(), repository_id: '999' }) +
        '.' +
        signature,
      [jwk],
      hash,
      sec,
    ),
  );
  await assert.rejects(() =>
    verifySignedToken(
      enc({ alg: 'none', kid: 'local-test' }) + '.' + payload + '.' + signature,
      [jwk],
      hash,
      sec,
    ),
  );
});
