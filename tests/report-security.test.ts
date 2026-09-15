import test from 'node:test';
import assert from 'node:assert/strict';
import { checkClaims, ingestUrl } from '../lib/oidc.ts';
import { dependencyIds } from '../lib/quality.ts';
import { keepLastGood } from '../lib/snapshot.ts';
import type { Bundle } from '../lib/data.ts';
import fs from 'node:fs';
void test('report audience is bound to route, snapshot and PDF digest', () => {
  const now = Math.floor(Date.now() / 1000),
    hash = 'a'.repeat(64),
    snapshot = 'b'.repeat(64),
    analysis = 'd'.repeat(64),
    base =
      ingestUrl.replace('/ingest', '/report') +
      '?snapshot=' +
      snapshot +
      '&analysis=' +
      analysis;
  const claims = {
    iss: 'https://token.actions.githubusercontent.com',
    aud: base + '#sha256=' + hash,
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
    iat: now,
    exp: now + 300,
    nbf: now,
    jti: 'report-test',
    run_id: '1',
    run_number: '1',
    run_attempt: '1',
  };
  checkClaims(claims, hash, now, base);
  assert.throws(() =>
    checkClaims(claims, hash, now, base.replace(analysis, 'e'.repeat(64))),
  );
  assert.throws(() => checkClaims(claims, hash, now, ingestUrl));
  assert.throws(() => checkClaims(claims, 'c'.repeat(64), now, base));
  assert.throws(() =>
    checkClaims(claims, hash, now, base.replace(snapshot, 'c'.repeat(64))),
  );
});
void test('real DEX source IDs are not confused with calculated shares', () => {
  assert.deepEqual(dependencyIds('dex_spot_market_share'), [
    'dex_spot_market_share',
  ]);
  assert.deepEqual(dependencyIds('dex_perp_market_share'), [
    'dex_perp_market_share',
  ]);
});
void test('failed attempt metadata survives last-good data retention', () => {
  const previous = JSON.parse(
    fs.readFileSync(new URL('../data/bootstrap.json', import.meta.url), 'utf8'),
  ) as Bundle;
  const next = structuredClone(previous);
  next.datasets[0].rows = [];
  next.datasets[0].collection = {
    attemptedAt: new Date().toISOString(),
    result: 'failed',
    error: 'network timeout',
  };
  const actual = keepLastGood(next, previous).datasets[0];
  assert.equal(actual.collection?.result, 'failed');
  assert.equal(actual.fetchedAt, previous.datasets[0].fetchedAt);
  assert.deepEqual(actual.rows, previous.datasets[0].rows);
});
