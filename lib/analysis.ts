import type { Bundle, Dataset } from './data';

export type Sector = 'cex' | 'dex' | 'stocks' | 'hyperliquid';
export type Fact = {
  id: string;
  sector: Sector;
  datasetId: string;
  title: string;
  statement: string;
  asOf: string | null;
  fetchedAt: string;
  source: { name: string; url: string };
  limitation: string;
  values: Record<string, number | null>;
};
export type AnalysisPoint = {
  sector: Sector;
  title: string;
  interpretation: string;
  implication: string;
  watch: string;
  factIds: string[];
};
export type Analysis = {
  version: 1;
  producer: 'Codex';
  snapshotId: string;
  reportDate: string;
  factsHash: string;
  generatedAt: string;
  points: AnalysisPoint[];
  facts: Fact[];
};
export const sectorNames: Record<Sector, string> = {
  cex: 'CEX',
  dex: 'DEX',
  stocks: '代币化股票',
  hyperliquid: 'Hyperliquid',
};
const metrics: {
  id: string;
  field: string;
  sector: Sector;
  title: string;
  entity?: string;
}[] = [
  {
    id: 'cex_spot_daily',
    field: 'ALL',
    sector: 'cex',
    title: '原站现货样本成交额（含部分链上平台）',
  },
  {
    id: 'cex_futures_daily',
    field: 'ALL',
    sector: 'cex',
    title: '原站合约样本成交额',
  },
  {
    id: 'futures_oi_btc',
    field: 'value',
    sector: 'cex',
    title: 'BTC 未平仓合约名义价值',
    entity: 'BTC',
  },
  {
    id: 'tradfi_stocks',
    field: 'Stocks',
    sector: 'stocks',
    title: '来源 Stocks 分类成交额',
  },
];
function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function money(v: number) {
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function percent(v: number) {
  return (v > 0 ? '+' : '') + v.toFixed(2) + '%';
}
function base(
  d: Dataset,
  sector: Sector,
  title: string,
  id = d.id,
): Omit<Fact, 'statement' | 'values'> {
  return {
    id,
    sector,
    datasetId: d.id,
    title,
    source: d.source,
    asOf: d.asOf,
    fetchedAt: d.fetchedAt,
    limitation:
      d.note +
      ' 比较排除获取时尚未结束的 UTC 日期；来源日界线、完整性及独立逐点对账尚未确认。成交额不能直接代表净资金流入或收入。',
  };
}
export function analysisFacts(bundle: Bundle): Fact[] {
  const date = bundle.edition?.reportDate || bundle.generatedAt.slice(0, 10);
  const facts: Fact[] = [];
  for (const metric of metrics) {
    const d = bundle.datasets.find((x) => x.id === metric.id);
    if (!d) continue;
    const grouped = new Map<string, number[]>();
    for (const row of d.rows) {
      if (
        typeof row.date !== 'string' ||
        row.date >= date ||
        !d.fetchedAt ||
        row.date >= new Date(d.fetchedAt).toISOString().slice(0, 10) ||
        (metric.entity && row.entity !== metric.entity)
      )
        continue;
      const v = row[metric.field];
      if (!finite(v) || v < 0) continue;
      grouped.set(row.date, [...(grouped.get(row.date) || []), v]);
    }
    const entries = [...grouped]
      .filter(([, vs]) => vs.length === 1)
      .sort(([a], [b]) => a.localeCompare(b));
    const last = entries.at(-1);
    if (!last) {
      facts.push({
        ...base(d, metric.sector, metric.title),
        statement: '截止本日报时间，无通过日期及数值检查的完整日数据。',
        values: {},
      });
      continue;
    }
    const [asOf, [latest]] = last;
    const priorDate = new Date(Date.parse(asOf) - 86400000)
      .toISOString()
      .slice(0, 10);
    const prior = grouped.get(priorDate);
    const change1dPct =
      prior?.length === 1 && prior[0] > 0
        ? (latest / prior[0] - 1) * 100
        : null;
    const window = (days: number, offset = 0) => {
      const vs: number[] = [];
      for (let i = offset; i < days + offset; i++) {
        const k = new Date(Date.parse(asOf) - i * 86400000)
          .toISOString()
          .slice(0, 10);
        const v = grouped.get(k);
        if (!v || v.length !== 1) return null;
        vs.push(v[0]);
      }
      return vs.reduce((a, b) => a + b, 0) / days;
    };
    const mean7d = window(7),
      priorMean7d = window(7, 7),
      mean30d = window(30);
    const change7dPct =
      mean7d !== null && priorMean7d !== null && priorMean7d > 0
        ? (mean7d / priorMean7d - 1) * 100
        : null;
    const statement =
      `${asOf}，${metric.title}为 ${money(latest)}。` +
      (change1dPct !== null
        ? `较前一日 ${percent(change1dPct)}。`
        : '前一日可比数据不足。') +
      (change7dPct !== null
        ? `最近七个连续日均值较此前七日 ${percent(change7dPct)}。`
        : '连续两周可比数据不足，不计算周度变化。') +
      (mean30d !== null
        ? `最近三十个连续日均值 ${money(mean30d)}。`
        : '连续三十日数据不足。');
    facts.push({
      ...base(d, metric.sector, metric.title),
      asOf,
      statement,
      values: {
        latest,
        change1dPct,
        mean7d,
        priorMean7d,
        change7dPct,
        mean30d,
      },
    });
  }
  for (const id of ['dex_spot_market_share', 'dex_perp_market_share']) {
    const d = bundle.datasets.find((x) => x.id === id);
    if (d)
      facts.push({
        ...base(d, 'dex', d.title),
        statement:
          'DEX 全市场份额数据待接入，不能据当前子生态样本判断全市场竞争格局。',
        values: {},
      });
  }
  const hl = bundle.datasets.find((x) => x.id === 'hl_dex_totals_snapshot');
  if (hl) {
    const core = hl.rows.find((r) => r.dex === 'core');
    const v = core?.volume_24h_usd,
      oi = core?.oi_usd_mark;
    const complete =
      core && core.missing_oi_assets === 0 && core.missing_volume_assets === 0;
    facts.push({
      ...base(hl, 'hyperliquid', 'Hyperliquid Core 当前快照'),
      statement:
        complete && finite(v) && finite(oi)
          ? `Hyperliquid Core 最近取得快照：滚动二十四小时成交额 ${v.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${core.quote_symbol}，持仓名义价值 ${oi.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${core.quote_symbol}。`
          : 'Hyperliquid Core 当前快照缺失或字段覆盖不完整，不引用汇总数字。',
      limitation:
        '官方当前快照，实际采样时间见来源记录；滚动二十四小时成交额与自然日成交额不可直接相加比较。报价币未按汇率换算为美元；缺少同口径历史，不判断日度趋势。',
      values:
        complete && finite(v) && finite(oi)
          ? { volume24h: v, openInterest: oi }
          : {},
    });
  }
  return facts;
}
export async function factsDigest(facts: Fact[]) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(facts)),
  );
  return [...new Uint8Array(hash)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}
export async function validateAnalysis(
  input: unknown,
  bundle: Bundle,
  now = Date.now(),
): Promise<Analysis> {
  if (!input || typeof input !== 'object') throw Error('Invalid analysis');
  const a = input as Analysis;
  const facts = analysisFacts(bundle),
    hash = await factsDigest(facts);
  if (
    a.version !== 1 ||
    a.producer !== 'Codex' ||
    a.snapshotId !== bundle.snapshotId ||
    a.reportDate !== bundle.edition?.reportDate ||
    a.factsHash !== hash
  )
    throw Error('Analysis evidence mismatch');
  if (
    !Number.isFinite(Date.parse(a.generatedAt)) ||
    Date.parse(a.generatedAt) > now + 60000 ||
    Date.parse(a.generatedAt) < Date.parse(bundle.edition.cutoffAt)
  )
    throw Error('Invalid analysis time');
  if (!Array.isArray(a.points) || a.points.length < 4 || a.points.length > 5)
    throw Error('Expected four or five analysis points');
  const ids = new Map(facts.map((f) => [f.id, f]));
  for (const p of a.points) {
    if (
      !Object.hasOwn(sectorNames, p.sector) ||
      !Array.isArray(p.factIds) ||
      p.factIds.length < 1 ||
      p.factIds.length > 3 ||
      new Set(p.factIds).size !== p.factIds.length ||
      p.factIds.some((id) => ids.get(id)?.sector !== p.sector)
    )
      throw Error('Invalid evidence citation');
    for (const k of [
      'title',
      'interpretation',
      'implication',
      'watch',
    ] as const) {
      if (
        typeof p[k] !== 'string' ||
        !p[k].trim() ||
        p[k].length > (k === 'title' ? 40 : 180) ||
        /[0-9<>]/.test(p[k])
      )
        throw Error(
          'Commentary must be concise plain text without invented numerical claims',
        );
    }
  }
  if (new Set(a.points.map((p) => p.sector)).size !== 4)
    throw Error('Missing sector');
  return {
    version: 1,
    producer: 'Codex',
    snapshotId: a.snapshotId,
    reportDate: a.reportDate,
    factsHash: hash,
    generatedAt: new Date(a.generatedAt).toISOString(),
    points: a.points.map(
      ({ sector, title, interpretation, implication, watch, factIds }) => ({
        sector,
        title,
        interpretation,
        implication,
        watch,
        factIds,
      }),
    ),
    facts,
  };
}
