import type { Bundle, Dataset, Row } from './data';

export const schedule = {
  timezone: 'Asia/Shanghai',
  times: ['09:17', '13:47'],
  text: '每日 09:17、13:47（北京时间）',
};
export const withheldIds = [
  'dex_spot_market_share',
  'dex_perp_market_share',
  'hl_fees_daily',
  'cex_reserve_score',
];
export function coverage(d: Dataset): Record<string, unknown> {
  return d.coverage && typeof d.coverage === 'object'
    ? (d.coverage as Record<string, unknown>)
    : {};
}
export function sourcePolicy(d: Dataset) {
  const official = d.id.startsWith('hl_') && d.id.endsWith('_snapshot');
  const c = coverage(d);
  const blocked = withheldIds.includes(d.id) || !d.rows.length;
  const unitReview = /source-|mixed|待核|来源页面|no FX/.test(d.unit);
  const definitionReview =
    unitReview ||
    d.status === 'review' ||
    d.id.startsWith('rh_') ||
    (d.id.startsWith('hl_') && !official);
  return {
    sourceLevel: official
      ? '交易所官方接口'
      : blocked
        ? '候选来源 / 未接入'
        : '原站聚合或查询缓存',
    reliability: blocked
      ? '等待来源或方法确认'
      : definitionReview
        ? '口径待核，限参考观察'
        : '结构与基础单位已核，尚未独立对账',
    useStatus: blocked ? '未启用' : '公开使用条件待核实',
    basis: official
      ? '官方逐市场当前快照；报价币包含 USDC、USDe、USDH、USDT0，未作美元汇率换算。'
      : d.id.startsWith('rh_')
        ? '缺少查询 SQL 与主网/测试网身份核验；来源数据不能代替链上独立复算。'
        : d.note,
    grain: d.grain,
    publication:
      d.grain === 'month'
        ? '月频；取已结束月份'
        : d.grain.includes('snapshot')
          ? '当前快照；没有统一服务端时间时以采集时点标识'
          : '日频；来源日界线及最后一日完整性待核',
    lagHours:
      d.grain === 'month'
        ? 35 * 24
        : official
          ? 24
          : d.id.startsWith('cex_')
            ? 72
            : 48,
    definitionReview,
    blocked,
    history: `${metaText(c.from,c.sourceFrom,'起点未注明')} 至 ${metaText(c.to,c.sourceThrough,d.asOf,'终点未注明')}`,
    truncated: c.truncated === true,
  };
}
export function freshness(d: Dataset, now = Date.now()) {
  if (!d.rows.length) return { key: 'missing', text: '数据暂缺' };
  if (!d.asOf || !Number.isFinite(Date.parse(d.asOf)))
    return { key: 'unknown', text: '源时间未提供' };
  // A date-only watermark denotes a source day, not a midnight observation.
  const watermark =
    Date.parse(d.asOf) + (/^\d{4}-\d{2}-\d{2}$/.test(d.asOf) ? 86400000 : 0);
  const lag = Math.max(0, now - watermark);
  const delayed = lag > sourcePolicy(d).lagHours * 3600000;
  return {
    key: delayed ? 'delayed' : 'current',
    text: delayed
      ? `源数据延迟 ${Math.floor(lag / 86400000)} 天`
      : '在检查阈值内',
  };
}
export function collectionState(d: Dataset) {
  if (withheldIds.includes(d.id)) return '未启用采集';
  if (d.collection?.result === 'failed') return '本轮失败，保留旧值';
  if (d.collection?.result === 'ok') return '本轮采集成功';
  if (!d.rows.length) return '尚无有效采集';
  return '历史快照，逐次日志待积累';
}
export function displayStatus(d: Dataset, now = Date.now()): Dataset['status'] {
  if (!d.rows.length) return 'pending';
  if (freshness(d, now).key === 'delayed' || d.collection?.result === 'failed')
    return 'stale';
  return sourcePolicy(d).definitionReview ? 'review' : 'ready';
}
export function batchHealth(b: Bundle, now = Date.now()) {
  if (b.delivery === 'bootstrap')
    return { healthy: false, text: '服务暂时回退初始快照' };
  if (now - Date.parse(b.generatedAt) > 26 * 3600000)
    return { healthy: false, text: '采集批次超过 26 小时未更新' };
  return { healthy: true, text: '最近批次已发布' };
}
export function sourceTime(s?: string | null) {
  if (!s) return '未提供';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date(s).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
  });
}
export function columnUnit(d: Dataset, key: string): string {
  if (
    /date|time|entity|exchange|dex|symbol|sector|referenceVenue|referenceStale|refresh_error/i.test(
      key,
    ) &&
    !/price|funding/i.test(key)
  )
    return '';
  if (/IntervalHours/.test(key)) return '小时';
  if (key.endsWith('Pct')) return '%';
  if (key === 'funding_hourly') return '小数 / 小时';
  if (
    /sourceRate|FundingRate|fundingRate|sourceApr|Spread|sourceFee|Premium/.test(
      key,
    )
  )
    return '源单位待核';
  if (
    /pairCount|focusHits|asset_count|trades|transactions|tokens_launched|active_markets/.test(
      key,
    )
  )
    return '个 / 次';
  if (/wallet|unique_traders/.test(key)) return '地址';
  if (key === 'oi_native') return '标的数量';
  if (key === 'max_leverage') return '倍';
  if (d.id.endsWith('_snapshot'))
    return /price|notional|volume_24h_usd|oi_usd_mark/.test(key)
      ? '报价币'
      : '';
  if (/Usd|_usd$/.test(key)) return 'USD';
  if (/referencePrice|mark_price/.test(key)) return '报价币';
  return d.unit === 'mixed' ? '' : d.unit;
}
export function projectedRows(d: Dataset): Row[] {
  if (d.id !== 'stablecoin_marketcap') return d.rows;
  const allowed = new Set([
    'date',
    'timestamp',
    ...d.dimensions,
    ...d.measures,
  ]);
  return d.rows.map((r) =>
    Object.fromEntries(Object.entries(r).filter(([k]) => allowed.has(k))),
  );
}
export function dependencyIds(id: string): string[] {
  if (withheldIds.includes(id)) return [id];
  if (id === 'cex_exchange_comparison')
    return [
      'cex_spot_daily',
      'cex_futures_daily',
      'cex_reserves_daily',
      'tradfi_stock_exchanges',
      'tradfi_stock_oi_exchanges',
    ];
  if (id.endsWith('_share')) return dependencyIds(id.slice(0, -6));
  if (id.endsWith('_oi')) return dependencyIds(id.slice(0, -3));
  if (id.endsWith('_ma7')) return dependencyIds(id.slice(0, -4));
  if (id.startsWith('cex_futures_spot_ratio_')) {
    const period = id.endsWith('monthly') ? 'monthly' : 'daily';
    return [`cex_spot_${period}`, `cex_futures_${period}`];
  }
  return [id];
}

export function dataChecks(d: Dataset) {
  const nullRows = d.rows.filter((r) =>
    d.measures.some((k) => r[k] === null || r[k] === undefined),
  ).length;
  const c = coverage(d);
  const oi = c.sourceOiCoverage as
    | { pair_count?: number; success_count?: number; missing_count?: number }
    | undefined;
  const discrepancy =
    oi &&
    typeof oi.pair_count === 'number' &&
    typeof oi.success_count === 'number' &&
    typeof oi.missing_count === 'number'
      ? oi.pair_count - oi.success_count - oi.missing_count
      : null;
  return { nullRows, oiCoverageDiscrepancy: discrepancy };
}

export function unitLabel(unit: string) {
  return (
    (
      {
        USD: '美元',
        'source-rate': '源费率（量纲待核）',
        'source-unit': '源单位（待核）',
        mixed: '混合指标，见列单位',
        ratio: '倍',
        count: '次',
        addresses: '地址',
        tokens: '代币数量',
        pairs: '交易对',
        'USD (来源页面口径)': '美元（来源口径待核）',
        'USD-pegged quote notional; no FX adjustment':
          '锚定美元的报价币名义值（未换汇）',
        'source native; USD待核': '源生单位（美元口径待核）',
      } as Record<string, string>
    )[unit] || unit
  );
}

export function metaText(...values:unknown[]):string { return values.find((v):v is string=>typeof v==='string' && !!v) || ''; }
