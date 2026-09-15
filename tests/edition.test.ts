import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  enforceCutoff,
  editionTimes,
  hongKongDate,
  editionStatus,
} from '../lib/edition.ts';
import {
  analysisFacts,
  factsDigest,
  validateAnalysis,
} from '../lib/analysis.ts';
import { keepLastGood } from '../lib/snapshot.ts';
import type { Bundle } from '../lib/data.ts';
const base = JSON.parse(
  fs.readFileSync(new URL('../data/bootstrap.json', import.meta.url), 'utf8'),
) as Bundle;
const time = editionTimes('2026-09-15');
const b = (): Bundle => ({
  ...structuredClone(base),
  generatedAt: '2026-09-15T00:55:00.000Z',
  snapshotId: 'a'.repeat(64),
  edition: {
    ...time,
    calendar: {
      label: '香港工作日',
      isBusinessDay: true,
      source: 'https://www.1823.gov.hk/common/ical/sc.json',
    },
  },
});
void test('Hong Kong date and daily deadline have a stable UTC boundary including weekends', () => {
  assert.equal(hongKongDate(Date.parse('2026-09-14T16:00:00Z')), '2026-09-15');
  assert.equal(time.cutoffAt, '2026-09-15T01:00:00.000Z');
  assert.equal(
    editionTimes('2026-09-19').deadlineAt,
    '2026-09-19T02:00:00.000Z',
  );
  assert.throws(() => editionTimes('2026-02-30'));
});
void test('current-only data obtained after cutoff cannot be backdated, including nested observation times', () => {
  const x = b();
  const d = x.datasets[0];
  d.fetchedAt = '2026-09-15T01:00:01Z';
  assert.equal(enforceCutoff(x, time.cutoffAt).datasets[0].rows.length, 0);
  d.fetchedAt = '2026-09-15T00:59:00Z';
  d.rows[0].observed_at = '2026-09-15T01:01:00Z';
  assert.equal(enforceCutoff(x, time.cutoffAt).datasets[0].rows.length, 0);
  d.rows[0].observed_at = '2026-09-15T00:59:00Z';
  assert.ok(enforceCutoff(x, time.cutoffAt).datasets[0].rows.length > 0);
});
void test('last-good retention also applies cutoff to the previous data', () => {
  const old = b(),
    incoming = b();
  old.datasets[0].fetchedAt = '2026-09-15T01:01:00Z';
  incoming.datasets[0].rows = [];
  const result = keepLastGood(
    enforceCutoff(incoming, time.cutoffAt),
    enforceCutoff(old, time.cutoffAt),
  );
  assert.equal(result.datasets[0].rows.length, 0);
});
void test('analysis computes contiguous calendar-day comparisons and rejects duplicate day evidence', () => {
  const x = b();
  const d = x.datasets.find((d) => d.id === 'cex_spot_daily')!;
  d.fetchedAt = '2026-09-15T00:55:00Z';
  d.rows = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.parse('2026-09-14') - i * 86400000)
      .toISOString()
      .slice(0, 10),
    ALL: i < 7 ? 200 : 100,
  }));
  let f = analysisFacts(x).find((f) => f.id === d.id)!;
  assert.equal(f.values.change7dPct, 100);
  assert.equal(f.values.change1dPct, 0);
  d.rows.push({ ...d.rows[5] });
  f = analysisFacts(x).find((f) => f.id === d.id)!;
  assert.equal(f.values.change7dPct, null);
  d.rows.push({ date: '2026-09-15', ALL: 999999 });
  assert.equal(analysisFacts(x).find((f) => f.id === d.id)!.values.latest, 200);
});
void test('Codex analysis is bound to exact facts, date, snapshot and four sectors', async () => {
  const x = b(),
    facts = analysisFacts(x);
  const input = {
    version: 1,
    producer: 'Codex',
    snapshotId: x.snapshotId,
    reportDate: time.reportDate,
    factsHash: await factsDigest(facts),
    generatedAt: '2026-09-15T01:20:00Z',
    points: ['cex', 'dex', 'stocks', 'hyperliquid'].map((sector) => ({
      sector,
      title: '观察已有数据',
      interpretation: '仅据来源样本评估变化。',
      implication: '暂保持观察。',
      watch: '关注可比数据持续性。',
      factIds: [facts.find((f) => f.sector === sector)!.id],
    })),
  };
  const now = Date.parse('2026-09-15T01:25:00Z');
  const actual = await validateAnalysis(input, x, now);
  assert.equal(actual.facts.length, facts.length);
  await assert.rejects(() =>
    validateAnalysis({ ...input, snapshotId: 'b'.repeat(64) }, x, now),
  );
  await assert.rejects(() =>
    validateAnalysis({ ...input, factsHash: 'b'.repeat(64) }, x, now),
  );
  const changed = structuredClone(input);
  changed.points[0].interpretation = '上涨了99%';
  await assert.rejects(() => validateAnalysis(changed, x, now));
  changed.points[0].interpretation = '依据不匹配';
  changed.points[0].factIds = ['dex_spot_market_share'];
  await assert.rejects(() => validateAnalysis(changed, x, now));
});
void test('after 10am an old edition is explicitly delayed without relabeling it', () => {
  const x = b();
  x.edition!.reportDate = '2026-09-14';
  x.edition!.publishedAt = '2026-09-14T01:30:00Z';
  assert.match(editionStatus(x, Date.parse(time.deadlineAt)), /延迟/);
  assert.equal(x.edition!.reportDate, '2026-09-14');
});

void test('a prior intraday observation is not promoted to a full-day comparison', () => {
  const x = b(),
    d = x.datasets.find((d) => d.id === 'cex_spot_daily')!;
  d.fetchedAt = '2026-09-14T23:25:00Z';
  d.rows = [
    { date: '2026-09-13', ALL: 100 },
    { date: '2026-09-14', ALL: 500 },
  ];
  const f = analysisFacts(x).find((f) => f.id === d.id)!;
  assert.equal(f.asOf, '2026-09-13');
  assert.equal(f.values.latest, 100);
});
void test('space-separated and numerical observation times obey the cutoff', () => {
  const x = b(),
    d = x.datasets[0];
  d.fetchedAt = '2026-09-15T00:55:00Z';
  d.rows[0].referenceAsOf = '2026-09-15 01:05:00+00:00';
  assert.equal(enforceCutoff(x, time.cutoffAt).datasets[0].rows.length, 0);
  delete d.rows[0].referenceAsOf;
  d.rows[0].timestamp = Date.parse('2026-09-15T01:05:00Z') / 1000;
  assert.equal(enforceCutoff(x, time.cutoffAt).datasets[0].rows.length, 0);
});
