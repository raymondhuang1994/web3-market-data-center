import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  generateBigModelAnalysis,
  BigModelError,
  BIGMODEL_ENDPOINT,
  retryAfterSeconds,
} from '../lib/bigmodel.ts';
import {
  analysisFacts,
  factsDigest,
  validateAnalysis,
} from '../lib/analysis.ts';
import type { Bundle } from '../lib/data.ts';
import { editionTimes } from '../lib/edition.ts';
const now = Date.parse('2026-09-15T01:12:00Z');
function bundle(): Bundle {
  const b = JSON.parse(
    fs.readFileSync(new URL('../data/bootstrap.json', import.meta.url), 'utf8'),
  ) as Bundle;
  return {
    ...b,
    snapshotId: 'a'.repeat(64),
    edition: {
      ...editionTimes('2026-09-15'),
      calendar: { label: '香港工作日', isBusinessDay: true, source: 'test' },
    },
  };
}
function points(b: Bundle) {
  const facts = analysisFacts(b);
  return ['cex', 'dex', 'stocks', 'hyperliquid'].map((sector) => ({
    sector,
    title: '观察可比证据',
    interpretation: '仅据样本观察，结论受来源覆盖限制。',
    implication: '待可比证据完备后评估业务方向。',
    watch: '关注同口径数据完整性。',
    factIds: [facts.find((f) => f.sector === sector)!.id],
  }));
}
function reply(content: unknown, finish = 'stop') {
  return new Response(
    JSON.stringify({
      choices: [
        {
          finish_reason: finish,
          message: { content: JSON.stringify(content) },
        },
      ],
    }),
  );
}
void test('free BigModel request is server-bound, tool-free and receives only canonical evidence', async () => {
  const b = bundle();
  let count = 0;
  const fetcher = (async (url, init) => {
    count++;
    assert.equal(url, BIGMODEL_ENDPOINT);
    assert.equal(init?.redirect, 'manual');
    assert.equal(typeof init?.body, 'string');
    const payload = JSON.parse(init?.body as string);
    assert.equal(payload.model, 'glm-4.7-flash');
    assert.equal(payload.tools, undefined);
    assert.equal(payload.thinking.type, 'disabled');
    assert.equal(payload.max_tokens, 3000);
    assert.equal(JSON.stringify(payload).includes('test-secret'), false);
    return reply({ points: points(b) });
  }) as typeof fetch;
  const result = await generateBigModelAnalysis(b, 'test-secret', fetcher, now);
  assert.equal(count, 1);
  assert.equal(result.producer, 'BigModel');
  assert.equal(result.model, 'glm-4.7-flash');
  assert.equal(result.snapshotId, b.snapshotId);
  assert.equal(result.factsHash, await factsDigest(analysisFacts(b)));
  assert.equal(JSON.stringify(result).includes('test-secret'), false);
});
void test('documented provider limits distinguish temporary failures from account blocks', async () => {
  for (const [code, category, retryable] of [
    ['1305', 'platform_overloaded', true], [1302, 'account_rate_limited', true],
    ['1113', 'account_balance_blocked', false], ['1308', 'quota_exhausted', false],
    ['1314', 'subscription_inactive', false], ['unknown-secret', 'http_429', true],
  ] as const) {
    await assert.rejects(generateBigModelAnalysis(bundle(), 'test-secret', (async () =>
      new Response(JSON.stringify({ error: { code, message: 'private-account test-secret' } }),
        { status: 429, headers: { 'Retry-After': '120' } })) as typeof fetch, now),
      (error: unknown) => {
        assert.ok(error instanceof BigModelError);
        assert.equal(error.code, 'bigmodel_' + category);
        assert.equal(error.retryable, retryable);
        assert.equal(error.retryAfterSeconds, retryable ? 120 : undefined);
        assert.doesNotMatch(JSON.stringify(error), /private-account|test-secret|unknown-secret/);
        return true;
      });
  }
});
void test('Retry-After uses valid delays without reducing long provider waits', () => {
  assert.equal(retryAfterSeconds('120', now), 120);
  assert.equal(retryAfterSeconds(new Date(now + 300000).toUTCString(), now), 300);
  assert.equal(retryAfterSeconds('7200', now), 7200);
  for (const invalid of ['-1', 'NaN', '1.5', 'invalid']) {
    assert.equal(retryAfterSeconds(invalid, now), undefined);
  }
});
void test('missing key and premature generation make no external call', async () => {
  const fetcher = (() => {
    throw Error('Unexpected call');
  }) as typeof fetch;
  await assert.rejects(
    generateBigModelAnalysis(bundle(), '', fetcher, now),
    /bigmodel_key_missing/,
  );
  await assert.rejects(
    generateBigModelAnalysis(bundle(), 'test', fetcher, now - 3600000),
    /cutoff_not_reached/,
  );
});
void test('provider throttling, errors and redirects never expose account response or secret', async () => {
  let redirects = 0;
  await assert.rejects(generateBigModelAnalysis(bundle(), 'test-secret', (async (_url, init) => {
    redirects++;
    assert.equal(init?.redirect, 'manual');
    return new Response('private-account-detail', {status:307,headers:{Location:'https://example.com/untrusted'}});
  }) as typeof fetch, now), /bigmodel_redirect_rejected/);
  assert.equal(redirects, 1);
  for (const status of [401, 429, 500]) {
    const fetcher = (async () =>
      new Response('private-account-detail test-secret', {
        status,
      })) as typeof fetch;
    await assert.rejects(
      generateBigModelAnalysis(bundle(), 'test-secret', fetcher, now),
      (error: unknown) => {
        assert.ok(error instanceof BigModelError);
        assert.equal(error.code, 'bigmodel_http_' + status);
        assert.equal(error.retryable, status !== 401);
        assert.equal(error.message.includes('private-account-detail'), false);
        return true;
      },
    );
  }
  await assert.rejects(
    generateBigModelAnalysis(
      bundle(),
      'test',
      (async () => {
        throw Error('test-secret');
      }) as typeof fetch,
      now,
    ),
    /bigmodel_network_error/,
  );
});
void test('malformed, truncated, fabricated and cross-sector commentary is rejected', async () => {
  const b = bundle(),
    invented = points(b),
    wrong = points(b);
  invented[0].interpretation = '上涨99%';
  wrong[0].factIds = ['dex_spot_market_share'];
  const factories = [
    () => new Response('not JSON'),
    () => reply({ points: points(b) }, 'length'),
    () => reply({ points: invented }),
    () => reply({ points: wrong }),
    () => reply({ points: [] }),
  ];
  for (const factory of factories)
    await assert.rejects(
      generateBigModelAnalysis(
        b,
        'test',
        (async () => factory()) as typeof fetch,
        now,
      ),
      /bigmodel_evidence_validation_failed/,
    );
});
void test('paid or unknown model metadata cannot pass publication validation', async () => {
  const b = bundle();
  const a = await generateBigModelAnalysis(
    b,
    'test',
    (async () => reply({ points: points(b) })) as typeof fetch,
    now,
  );
  for (const model of ['glm-5.3-flash', 'glm-4.7', undefined])
    await assert.rejects(validateAnalysis({ ...a, model }, b, now));
  await assert.rejects(validateAnalysis({ ...a, producer: 'Unknown' }, b, now));
  await assert.rejects(validateAnalysis({ ...a, producer: 'Codex' }, b, now));
});
void test('Chinese quantities and trading-day relabeling cannot bypass text validation', async () => {
  const b = bundle();
  for (const text of [
    '下降百分之五十六点四四',
    '成交额为六十四亿 USDC',
    '连续七个交易日上涨',
    '涨幅为９９％',
    '成交额下降五成六',
    '均值微升一点七五',
    '周均较上周下降',
    '单日变化可能受特定资产驱动',
  ]) {
    const p = points(b);
    p[0].interpretation = text;
    await assert.rejects(
      generateBigModelAnalysis(
        b,
        'test',
        (async () => reply({ points: p })) as typeof fetch,
        now,
      ),
      /bigmodel_evidence_validation_failed_text/,
    );
  }
});
void test('model sees calculated directions instead of rewriting exact amounts', async () => {
  const { qualitativeEvidence } = await import('../lib/bigmodel.ts');
  const fact = analysisFacts(bundle())[0];
  const input = qualitativeEvidence({
    ...fact,
    values: { latest: 100, mean7d: 200, change1dPct: -50, change7dPct: 4 },
  });
  assert.equal(input.observations.dailyDirection, '下降');
  assert.equal(input.observations.recentWeekMeanVsPriorWeek, '上升');
  assert.equal(input.observations.latestVsWeekMean, '下降');
  assert.equal('values' in input, false);
  assert.equal(JSON.stringify(input).includes('100'), false);
});
void test('business observations use facts and cannot inherit invented model causes', async () => {
  const b = bundle(),
    p = points(b);
  p[2].implication = '单日变化由机构买入导致';
  const a = await generateBigModelAnalysis(
    b,
    'test',
    (async () => reply({ points: p })) as typeof fetch,
    now,
  );
  assert.doesNotMatch(a.points[2].implication, /机构|导致/);
  assert.match(a.points[2].implication, /分类/);
  assert.deepEqual(
    a.points[0].factIds,
    analysisFacts(b)
      .filter((f) => f.sector === 'cex')
      .map((f) => f.id),
  );
});
