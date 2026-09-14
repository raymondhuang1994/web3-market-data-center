export type Row = Record<string, string | number | boolean | null>;
export type Dataset = {
  id: string;
  title: string;
  source: { name: string; url: string };
  fetchedAt: string;
  asOf: string | null;
  grain: string;
  unit: string;
  dimensions: string[];
  measures: string[];
  rows: Row[];
  status: 'ready' | 'stale' | 'pending' | 'review';
  note: string;
  coverage: unknown;
};
export type Bundle = {
  schemaVersion: number;
  generatedAt: string;
  datasets: Dataset[];
  delivery?: string;
};
export const colors = [
  '#3264e5',
  '#26a9b0',
  '#9e87de',
  '#e8b750',
  '#96abc9',
  '#dd8897',
];
export const labels: Record<string, string> = {
  value: '数值',
  date: '日期',
  entity: '交易所 / 类别',
  ALL: '样本合计',
  all_stablecoins: '稳定币合计',
  all_usdt: 'USDT',
  all_usdc: 'USDC',
  all_usde: 'USDe',
  all_usds_dai: 'USDS / DAI',
  open_interest: '持仓量',
  daily_volume: '日成交额',
  volume_24h_usd: '24h 成交额（报价币名义值）',
  oi_usd_mark: '持仓名义价值（报价币）',
  quote_symbol: '报价币',
  mark_price: '标记价格',
  funding_hourly: '每小时资金费率（小数）',
  pairCount: '交易对数',
  referencePrice: '参考价格',
  referenceAsOf: '参考报价时间',
  referenceSymbol: '参考标的',
  sourceApr: '源年化值（口径待核）',
  buyExchange: '买方交易所',
  sellExchange: '卖方交易所',
  buyIntervalHours: '买方结算小时',
  sellIntervalHours: '卖方结算小时',
  sourceRate: '源费率（口径待核）',
  sourceBestNetPremiumPct: '源净溢价 %',
  new: '新增钱包',
  returning: '回访钱包',
  core: 'Hyperliquid Core',
  Stocks: '股票',
  volume: '成交额',
  oi: '持仓量',
  volumeUsd: '成交额 USD',
  oiUsd: '持仓量 USD',
  fundingRate: '源资金费率',
  premiumPct: '溢价 %',
  cum_volume: '累计成交额',
};
export const label = (s: string) =>
  labels[s] || s.replace(/_stablecoins$/, ' 链').replace(/^all_/, '');
export const numeric = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
export function format(v: unknown, unit = '', compact = true): string {
  if (!numeric(v))
    return typeof v === 'string'
      ? v
      : typeof v === 'boolean'
        ? v
          ? '是'
          : '否'
        : '—';
  const prefix = unit === 'USD' ? '$' : '';
  if (unit === 'source-rate' || (Math.abs(v) > 0 && Math.abs(v) < 0.01))
    return prefix + v.toLocaleString('en-US', { maximumFractionDigits: 6 });
  if (compact) {
    const abs = Math.abs(v);
    if (abs >= 1e12) return prefix + (v / 1e12).toFixed(2) + 'T';
    if (abs >= 1e9) return prefix + (v / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return prefix + (v / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return prefix + (v / 1e3).toFixed(1) + 'K';
  }
  return prefix + v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
export function pending(
  id: string,
  title: string,
  note = '栏目已保留，等待可持续使用的免费数据源。',
): Dataset {
  return {
    id,
    title,
    note,
    source: { name: '待接入', url: 'https://data.wublock123.com/dashboard' },
    fetchedAt: '',
    asOf: null,
    grain: '待确认',
    unit: '',
    dimensions: [],
    measures: [],
    rows: [],
    status: 'pending',
    coverage: {},
  };
}
export function getDataset(bundle: Bundle, id: string) {
  return bundle.datasets.find((x) => x.id === id) || pending(id, id);
}
export function latestRows(d: Dataset) {
  const dates = d.rows.map((r) => String(r.date || '')).sort();
  const date = dates.at(-1);
  return date ? d.rows.filter((r) => r.date === date) : d.rows;
}
export function rank(
  d: Dataset,
  measure = 'value',
): { name: string; value: number }[] {
  const rows = latestRows(d);
  if (!rows.length) return [];
  if (rows[0].entity !== undefined)
    return rows
      .filter((r) => numeric(r[measure]))
      .map((r) => ({ name: String(r.entity), value: r[measure] as number }))
      .sort((a, b) => b.value - a.value);
  return d.measures
    .filter((k) => k !== 'ALL' && numeric(rows[0][k]))
    .map((k) => ({ name: k, value: rows[0][k] as number }))
    .sort((a, b) => b.value - a.value);
}
export function series(
  d: Dataset,
  days: number,
  measure = 'value',
  selected = 'all',
): { rows: Row[]; keys: string[] } {
  if (!d.rows.some((r) => r.date)) return { rows: [], keys: [] };
  let input = d.rows.filter((r) => typeof r.date === 'string');
  const last = Math.max(...input.map((r) => Date.parse(String(r.date))));
  input = input.filter(
    (r) => Date.parse(String(r.date)) >= last - (days - 1) * 86400000,
  );
  const long = input.some((r) => typeof r.entity === 'string');
  const keys =
    selected !== 'all'
      ? [selected]
      : long
        ? rank(d, measure)
            .slice(0, 5)
            .map((x) => x.name)
        : d.measures.includes('ALL')
          ? ['ALL']
          : rank(d)
              .slice(0, 5)
              .map((x) => x.name);
  if (!long) return { rows: input, keys };
  const byDate = new Map<string, Row>();
  for (const row of input) {
    const name = String(row.entity);
    if (!keys.includes(name)) continue;
    const date = String(row.date);
    const target = byDate.get(date) || { date };
    if (name in target) target[name] = null;
    else target[name] = numeric(row[measure]) ? row[measure] : null;
    byDate.set(date, target);
  }
  return {
    rows: [...byDate.values()].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    ),
    keys,
  };
}
export function statusText(d: Dataset) {
  return {
    ready: '已接入',
    stale: '源数据延迟',
    pending: '待接入',
    review: '口径待核',
  }[d.status];
}
export function latestValue(d: Dataset, key = 'ALL') {
  const rows = latestRows(d);
  if (!rows.length) return null;
  const v = rows[0][key] ?? rows[0].value;
  return numeric(v) ? v : null;
}
