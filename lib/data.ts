export type Row = Record<string, string | number | boolean | null>;
export type Dataset = {
  collection?: {
    attemptedAt: string;
    result: 'ok' | 'failed' | 'not-configured';
    error?: string;
  };
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
  snapshotId?: string;
  datasetCount?: number;
  withRows?: number;
  edition?: {
    reportDate: string;
    cutoffAt: string;
    deadlineAt: string;
    timezone: 'Asia/Hong_Kong';
    calendar: { label: string; isBusinessDay: boolean | null; source: string };
    publishedAt?: string | null;
    analysisHash?: string | null;
  };
  analysis?: import('./analysis').Analysis;
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
  transactions: '交易笔数',
  spotVolumeUsd: '现货成交额',
  futuresVolumeUsd: '合约成交额',
  reservesUsd: '储备资产',
  stocksVolumeUsd: '股票产品成交额',
  stocksOiUsd: '股票产品持仓',
  spotAsOf: '现货日期',
  futuresAsOf: '合约日期',
  reservesAsOf: '储备日期',
  stocksVolumeAsOf: '股票成交日期',
  stocksOiAsOf: '股票持仓日期',
  mean_7d: '7 日均值',
  dex: '部署市场',
  coin: '合约',
  collateral_token: '保证金币种',
  is_delisted: '是否下架',
  max_leverage: '最高杠杆',
  mid_price: '中间价',
  observed_at: '取得快照时间',
  oi_native: '持仓数量',
  oracle_price: '预言机价格',
  previous_day_price: '前一日价格',
  refresh_error: '本轮采集错误',
  usd_conversion_basis: '美元换算依据',
  volume_24h_native: '24h 成交额原值',
  active_metadata_count: '未下架元数据记录数',
  asset_count: '元数据记录数',
  missing_oi_assets: '持仓缺失数',
  missing_volume_assets: '成交额缺失数',
  referenceVenue: '参考市场',
  referenceStale: '参考价过期',
  sector: '板块',
  nextFundingTime: '下一次资金结算',
  sourceFundingSpread: '源资金费率差',
  sourcePriceSpread: '源价格差',
  sourceFee: '源费用估计',
  buyFundingRate: '买方源费率',
  sellFundingRate: '卖方源费率',
  buyOiUsd: '买方持仓 USD',
  sellOiUsd: '卖方持仓 USD',
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
export const label = (s: string) => {
  if (labels[s]) return labels[s];
  const suffix: Record<string, string> = {
    SourceFundingRate: '源资金费率',
    PremiumPct: '溢价',
    Instrument: '合约名称',
    AsOf: '报价时间',
    Price: '价格',
  };
  for (const [key, value] of Object.entries(suffix))
    if (s.endsWith(key)) return s.slice(0, -key.length) + ' ' + value;
  return s.replace(/_stablecoins$/, ' 链').replace(/^all_/, '');
};
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
  if (unit === '%')
    return v.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '%';
  if (unit === 'ratio') return v.toFixed(2) + '×';
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
export function getDataset(bundle: Bundle, id: string): Dataset {
  const direct = bundle.datasets.find((x) => x.id === id);
  if (direct) return direct;
  if (id === 'cex_exchange_comparison') return comparisonDataset(bundle, id);
  if (id.endsWith('_oi')) {
    const d = getDataset(bundle, id.slice(0, -3));
    return {
      ...d,
      id,
      title: d.title + ' · 持仓量',
      measures: ['value'],
      rows: d.rows.map((r) => ({ ...r, value: r.open_interest ?? null })),
    };
  }
  if (id.endsWith('_ma7'))
    return movingAverage(getDataset(bundle, id.slice(0, -4)), id);
  if (id.endsWith('_share'))
    return shareDataset(getDataset(bundle, id.slice(0, -6)), id);
  if (id.startsWith('cex_futures_spot_ratio_')) return ratioDataset(bundle, id);
  return pending(id, id);
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
  const rows = latestRows({
    ...d,
    rows: d.rows.filter((r) =>
      r.entity !== undefined
        ? numeric(r[measure])
        : d.measures.some((k) => numeric(r[k])),
    ),
  });
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

export function shareDataset(d: Dataset, id: string): Dataset {
  if (d.rows.some((r) => typeof r.entity === 'string')) {
    const entities = Array.from(new Set(d.rows.map((r) => String(r.entity))));
    const days = new Map<string, Row[]>();
    for (const r of d.rows) {
      const date = String(r.date);
      days.set(date, [...(days.get(date) || []), r]);
    }
    const rows: Row[] = [];
    for (const [date, group] of days) {
      const seen = new Set(group.map((r) => String(r.entity)));
      const valid =
        seen.size === group.length &&
        seen.size === entities.length &&
        group.every((r) => numeric(r.value) && r.value >= 0);
      const sum = valid
        ? group.reduce((n, r) => n + (r.value as number), 0)
        : 0;
      for (const r of group)
        rows.push({
          date,
          entity: r.entity,
          value: sum > 0 ? ((r.value as number) / sum) * 100 : null,
        });
    }
    return {
      ...d,
      id,
      title: d.title + ' · 来源样本构成',
      unit: '%',
      measures: ['value'],
      rows,
      note:
        '仅使用本数据集中同日全部已覆盖实体，缺实体、重复键、缺值或零分母时留空；主要系列展示不会重新归一化。类别/市场份额分别计算，不跨来源共用分母。 ' +
        d.note,
    };
  }
  const keys = d.measures.filter((k) => !['ALL', 'Total', 'total'].includes(k));
  const rows = d.rows.map((row) => {
    const valid = keys.every((k) => numeric(row[k]) && (row[k] as number) >= 0);
    const total = valid ? keys.reduce((a, k) => a + (row[k] as number), 0) : 0;
    return {
      date: row.date,
      ...Object.fromEntries(
        keys.map((k) => [
          k,
          total > 0 ? ((row[k] as number) / total) * 100 : null,
        ]),
      ),
    };
  });
  return {
    ...d,
    id,
    title: d.title + ' · 样本份额',
    rows,
    unit: '%',
    measures: keys,
    note:
      '分母为同一日期全部列示平台之和，排除 ALL / Total；任一平台缺报或总和为零时整日不计算。沿用原样本，包含部分 DEX，不代表全球 CEX 份额。 ' +
      d.note,
  };
}
export function ratioDataset(b: Bundle, id: string): Dataset {
  const period = id.endsWith('monthly') ? 'monthly' : 'daily';
  const spot = getDataset(b, 'cex_spot_' + period),
    futures = getDataset(b, 'cex_futures_' + period);
  const keys = spot.measures.filter(
    (k) =>
      futures.measures.includes(k) && !['ALL', 'Total', 'total'].includes(k),
  );
  const byDate = new Map(futures.rows.map((r) => [r.date, r]));
  const rows = spot.rows
    .filter((r) => byDate.has(r.date))
    .map((r) => {
      const f = byDate.get(r.date)!;
      return {
        date: r.date,
        ...Object.fromEntries(
          keys.map((k) => [
            k,
            numeric(r[k]) && r[k] > 0 && numeric(f[k]) ? f[k] / r[k] : null,
          ]),
        ),
      };
    });
  return {
    ...spot,
    id,
    title: '合约 / 现货成交额比',
    rows,
    measures: keys,
    unit: 'ratio',
    asOf:
      spot.asOf && futures.asOf
        ? spot.asOf < futures.asOf
          ? spot.asOf
          : futures.asOf
        : null,
    status:
      spot.status === 'stale' || futures.status === 'stale'
        ? 'stale'
        : spot.status,
    collection:
      spot.collection?.result === 'failed'
        ? spot.collection
        : futures.collection,
    note: '仅比较同时存在现货与合约数据的同一平台、同一日期。合约成交额 ÷ 现货成交额；分母为零或缺值不计算，不混用两侧 ALL 合计。',
  };
}

export function movingAverage(d: Dataset, id: string): Dataset {
  const byDate = new Map(d.rows.map((r) => [String(r.date), r.value]));
  const rows = d.rows.map((r) => {
    const values = Array.from({ length: 7 }, (_, i) =>
      byDate.get(
        new Date(Date.parse(String(r.date)) - i * 86400000)
          .toISOString()
          .slice(0, 10),
      ),
    );
    return {
      date: r.date,
      transactions: r.value,
      mean_7d: values.every(numeric)
        ? values.reduce((a, b) => a + b, 0) / 7
        : null,
    };
  });
  return {
    ...d,
    id,
    rows,
    measures: ['transactions', 'mean_7d'],
    dimensions: ['date'],
    title: d.title + ' · 7 日均线',
    note:
      '连续7个自然日的交易笔数算术平均；缺任何一天则留空，不将缺报视为零。 ' +
      d.note,
  };
}

export function comparisonDataset(b: Bundle, id: string): Dataset {
  const specs = [
    ['cex_spot_daily', 'spotVolumeUsd', 'spotAsOf'],
    ['cex_futures_daily', 'futuresVolumeUsd', 'futuresAsOf'],
    ['cex_reserves_daily', 'reservesUsd', 'reservesAsOf'],
    ['tradfi_stock_exchanges', 'stocksVolumeUsd', 'stocksVolumeAsOf'],
    ['tradfi_stock_oi_exchanges', 'stocksOiUsd', 'stocksOiAsOf'],
  ];
  const rows = new Map<string, Row>();
  for (const [source, key, timeKey] of specs) {
    const d = getDataset(b, source);
    for (const item of rank(d)) {
      const row = rows.get(item.name) || { entity: item.name };
      row[key] = item.value;
      row[timeKey] = d.asOf;
      rows.set(item.name, row);
    }
  }
  const base = getDataset(b, 'cex_spot_daily');
  return {
    ...base,
    id,
    title: '交易所综合对比',
    unit: 'mixed',
    grain: 'snapshot',
    status: 'review',
    dimensions: ['entity'],
    measures: specs.map((s) => s[1]),
    rows: [...rows.values()],
    note: '逐字段保留来源最新日期，现货/合约/储备/股票产品成交与持仓不是同一时点。未返回字段为缺值；包含部分DEX，沿用原样本；不将储备当净资产或偿付能力。',
  };
}
