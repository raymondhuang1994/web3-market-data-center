import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getDataset,
  shareDataset,
  movingAverage,
  type Bundle,
} from '../lib/data.ts';
import {
  freshness,
  batchHealth,
  projectedRows,
  dependencyIds,
} from '../lib/quality.ts';
import {
  reportManifest,
  reportWindow,
  tableGroups,
  constantColumns,
  tableColumns,
} from '../lib/report.ts';
const b = JSON.parse(
  fs.readFileSync(new URL('../data/bootstrap.json', import.meta.url), 'utf8'),
) as Bundle;
const d = b.datasets.find((d) => d.id === 'cex_spot_daily')!;
void test('shares exclude ALL and require a complete nonnegative denominator', () => {
  const source = {
    ...d,
    measures: ['A', 'B', 'ALL'],
    rows: [
      { date: '2026-09-01', A: 2, B: 3, ALL: 5 },
      { date: '2026-09-02', A: 2, B: null, ALL: 2 },
    ],
  };
  const out = shareDataset(source, 'test_share');
  assert.equal(out.rows[0].A, 40);
  assert.equal(out.rows[0].B, 60);
  assert.equal(out.rows[1].A, null);
  assert(!out.measures.includes('ALL'));
});
void test('same-source HL shares agree with audited values; missing entity invalidates full denominator', () => {
  const d = getDataset(b, 'hl_hip3_and_crypto_share');
  const row = d.rows.find(
    (r) => r.date === '2026-09-11' && r.entity === 'HIP-3',
  );
  assert(row && typeof row.value === 'number');
  assert(Math.abs(row.value - 21.8588017) < 1e-7);
  const source = getDataset(b, 'hl_hip3_and_crypto');
  const bad = {
    ...source,
    rows: source.rows.filter(
      (r) => !(r.date === '2026-09-11' && r.entity === 'Crypto'),
    ),
  };
  assert(
    shareDataset(bad, 'bad_share')
      .rows.filter((r) => r.date === '2026-09-11')
      .every((r) => r.value === null),
  );
});
void test('funding, OI, and nested derived dependencies never become different units', () => {
  assert.equal(getDataset(b, 'funding_btc').unit, 'source-rate');
  assert.equal(getDataset(b, 'hl_hip3_and_crypto_oi_share').unit, '%');
  assert.deepEqual(dependencyIds('hl_hip3_and_crypto_oi_share'), [
    'hl_hip3_and_crypto',
  ]);
});
void test('seven calendar day average never bridges missing days', () => {
  const source = {
    ...d,
    rows: Array.from({ length: 7 }, (_, i) => ({
      date: `2026-09-0${i + 1}`,
      value: i + 1,
    })),
    measures: ['value'],
  };
  assert.equal(movingAverage(source, 'ma').rows[6].mean_7d, 4);
  assert.equal(
    movingAverage(
      { ...source, rows: source.rows.filter((_, i) => i !== 3) },
      'ma',
    ).rows.at(-1)?.mean_7d,
    null,
  );
});
void test('time-dependent health expires and bootstrap fallback never appears healthy', () => {
  const now = Date.parse('2026-10-01T12:00:00Z');
  assert.equal(freshness(d, now).key, 'delayed');
  assert.equal(
    batchHealth({ ...b, delivery: 'bootstrap' }, Date.parse(b.generatedAt))
      .healthy,
    false,
  );
});
void test('chain table projection cannot retain coin totals', () => {
  const stable = getDataset(b, 'stablecoin_marketcap');
  const projected = {
    ...stable,
    measures: stable.measures.filter((k) => !k.startsWith('all_')),
  };
  assert(
    projectedRows(projected).every(
      (r) => !Object.keys(r).some((k) => k.startsWith('all_')),
    ),
  );
});
void test('report preserves route, tab, sector, table field and row coverage', () => {
  const manifest = reportManifest(b);
  assert.equal(manifest.routes, 13);
  assert.equal(manifest.sections, 33);
  assert.equal(manifest.sectors.length, 28);
  for (const id of manifest.detailDatasets) {
    const d = getDataset(b, id);
    assert.deepEqual(
      new Set([...tableGroups(d).flat(), ...constantColumns(d)]),
      new Set(tableColumns(d)),
    );
  }
});
void test('report removes unended calendar dates and months but preserves current snapshots', () => {
  const bundle = { ...b, generatedAt: '2026-09-14T12:00:00Z' };
  const daily = {
    ...d,
    rows: [
      { date: '2026-09-13', value: 1 },
      { date: '2026-09-14', value: 2 },
    ],
  };
  assert.equal(reportWindow(daily, bundle).rows.length, 1);
  assert.equal(
    reportWindow({ ...daily, grain: 'current snapshot' }, bundle).rows.length,
    2,
  );
  const monthly = {
    ...d,
    grain: 'month',
    rows: [
      { date: '2026-08-01', value: 1 },
      { date: '2026-09-01', value: 2 },
    ],
  };
  assert.equal(reportWindow(monthly, bundle).rows.length, 1);
});
