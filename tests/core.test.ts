import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  checkClaims,
  verifySignedToken,
  sha256,
  ingestUrl,
} from '../lib/oidc.ts';
import { validateBundle, keepLastGood } from '../lib/snapshot.ts';
import { series, rank, format, type Bundle } from '../lib/data.ts';
const baseline = JSON.parse(
  fs.readFileSync(new URL('../data/bootstrap.json', import.meta.url), 'utf8'),
) as Bundle;
const now = Date.now(),
  seconds = Math.floor(now / 1000),
  hash = 'a'.repeat(64);
const claims = {
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
  event_name: 'workflow_dispatch',
  runner_environment: 'github-hosted',
  sub: 'repo:raymondhuang1994@209585471/web3-market-data-center@1370214885:ref:refs/heads/main',
  iat: seconds,
  nbf: seconds,
  exp: seconds + 300,
  jti: 'test-jti',
  run_id: '1',
  run_attempt: '1',
  run_number: '1',
};
const clone = () => ({
  ...structuredClone(baseline),
  generatedAt: new Date(now).toISOString(),
});
void test('real source bundle satisfies production contract', () =>
  assert.equal(validateBundle(clone(), baseline, now).datasets.length, 49));
void test('claim allowlist rejects wrong repository, branch, event, audience, expiry and types', () => {
  checkClaims(claims, hash, seconds);
  for (const [key, value] of Object.entries({
    repository_id: '1',
    repository_owner_id: '1',
    ref: 'refs/heads/dev',
    event_name: 'pull_request',
    aud: 'wrong',
    exp: seconds - 100,
    iat: String(seconds),
    workflow_ref: 'wrong',
    sub: 'wrong',
    repository_visibility: 'internal',
  }))
    assert.throws(
      () => checkClaims({ ...claims, [key]: value }, hash, seconds),
      key,
    );
});
void test('self-hosted authorization preserves repository and main-workflow restrictions', () => {
  checkClaims({...claims,runner_environment:'self-hosted'},hash,seconds);
  for (const value of [undefined,null,'','macOS','unknown',true])
    assert.throws(()=>checkClaims({...claims,runner_environment:value},hash,seconds));
  for (const change of [{ref:'refs/heads/dev'},{repository_id:'1'},{workflow_ref:'other'},{aud:'other'}])
    assert.throws(()=>checkClaims({...claims,runner_environment:'self-hosted',...change},hash,seconds));
});
void test('public transition accepts only the same repository and main workflow on both runners', () => {
  for (const repository_visibility of ['private', 'public']) {
    for (const runner_environment of ['github-hosted', 'self-hosted']) {
      const candidate = { ...claims, repository_visibility, runner_environment };
      checkClaims(candidate, hash, seconds);
      for (const change of [
        { repository: 'fork/web3-market-data-center' },
        { repository_id: '999' },
        { repository_owner_id: '999' },
        { repository_owner: 'fork' },
        { ref: 'refs/pull/1/merge' },
        { ref: 'refs/heads/dev' },
        { ref_type: 'tag' },
        { workflow_ref: 'other' },
        { event_name: 'pull_request' },
        { event_name: 'pull_request_target' },
        { event_name: 'workflow_run' },
      ]) assert.throws(() => checkClaims({ ...candidate, ...change }, hash, seconds));
    }
  }
  for (const repository_visibility of [undefined, null, '', 'internal', true])
    assert.throws(() => checkClaims({ ...claims, repository_visibility }, hash, seconds));
});
void test('RS256 signature validation rejects altered payload and attacker key headers', async () => {
  const key = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', key.publicKey);
  const enc = (x: unknown) =>
    Buffer.from(JSON.stringify(x)).toString('base64url');
  const h = enc({ alg: 'RS256', kid: 'test' }),
    p = enc(claims),
    unsigned = h + '.' + p;
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key.privateKey,
    new TextEncoder().encode(unsigned),
  );
  const token = unsigned + '.' + Buffer.from(sig).toString('base64url');
  const keys = [{ ...jwk, kid: 'test' }];
  await verifySignedToken(token, keys, hash, seconds);
  await assert.rejects(
    verifySignedToken(
      h +
        '.' +
        enc({ ...claims, repository_id: '1' }) +
        '.' +
        Buffer.from(sig).toString('base64url'),
      keys,
      hash,
      seconds,
    ),
  );
  await assert.rejects(
    verifySignedToken(
      enc({ alg: 'RS256', kid: 'test', jku: 'https://attacker.test' }) +
        '.' +
        p +
        '.' +
        Buffer.from(sig).toString('base64url'),
      keys,
      hash,
      seconds,
    ),
  );
  await assert.rejects(verifySignedToken(token, keys, 'b'.repeat(64), seconds));
  assert.equal((await sha256(new TextEncoder().encode('abc'))).length, 64);
});
void test('schema validation blocks source changes, nested values, malformed dates and restricted datasets', () => {
  for (const mutate of [
    (b: Bundle) => {
      b.datasets[0].source.url = 'https://bad.test';
    },
    (b: Bundle) => {
      b.datasets[0].measures = [null] as unknown as string[];
    },
    (b: Bundle) => {
      b.datasets[0].rows[0].date = 'invalid';
    },
    (b: Bundle) => {
      b.datasets.find((d) => d.id === 'hl_fees_daily')!.rows = [
        { date: '2026-09-01', value: 1 },
      ];
    },
    (b: Bundle) => {
      b.datasets[0].unit = 'BTC';
    },
  ]) {
    const b = clone();
    mutate(b);
    assert.throws(() => validateBundle(b, baseline, now));
  }
});
void test('a failed source preserves data date and values without converting missing to zero', () => {
  const next = clone();
  next.datasets[0].rows = [];
  next.datasets[0].status = 'pending';
  const merged = keepLastGood(next, baseline);
  assert.deepEqual(merged.datasets[0].rows, baseline.datasets[0].rows);
  assert.equal(merged.datasets[0].asOf, baseline.datasets[0].asOf);
  assert.equal(merged.datasets[0].status, 'stale');
  assert.equal(format(null, 'USD'), '—');
});
void test('wide aggregates are not added twice; long duplicate dates become gaps', () => {
  const d = baseline.datasets.find((d) => d.id === 'cex_spot_daily')!;
  assert.deepEqual(series(d, 30).keys, ['ALL']);
  assert(!rank(d).some((x) => x.name === 'ALL'));
  const dupe = {
    ...d,
    measures: ['value'],
    rows: [
      { date: '2026-09-01', entity: 'X', value: 1 },
      { date: '2026-09-01', entity: 'X', value: 2 },
    ],
  };
  assert.equal(series(dupe, 30, 'value', 'X').rows[0].X, null);
});
