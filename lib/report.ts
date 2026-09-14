import { pages, type PanelDef } from './catalog.ts';
import { getDataset, numeric, type Bundle, type Dataset } from './data.ts';
import { columnUnit, dependencyIds, projectedRows } from './quality.ts';
export const reportVersion = '2026-09-v2';
export const overviewPanels: PanelDef[] = [
  { id: 'cex_spot_daily', title: '现货交易活跃度' },
  { id: 'cex_futures_daily', title: '合约交易活跃度' },
  { id: 'futures_oi_btc', title: 'BTC 未平仓合约' },
  { id: 'tradfi_stocks', title: '股票板块成交额' },
  { id: 'hl_hip3_and_crypto', title: 'Hyperliquid 市场结构' },
  { id: 'dex_spot_market_share', title: 'DEX 市场份额' },
];
export function reportSections() {
  return [
    { path: '/', title: '市场总览', view: '总览', panels: overviewPanels },
    ...pages.flatMap((p) =>
      p.views.map((v) => ({
        path: p.path,
        title: p.title,
        view: v.name,
        panels: v.panels,
      })),
    ),
  ];
}
export function reportDataset(
  bundle: Bundle,
  def: PanelDef,
  view: string,
): Dataset {
  let d = getDataset(bundle, def.id);
  if (d.id === 'stablecoin_marketcap') {
    const measures = d.measures.filter((k) =>
      view === '按链' ? !k.startsWith('all_') : k.startsWith('all_'),
    );
    d = { ...d, measures, rows: projectedRows({ ...d, measures }) };
  }
  if (!d.rows.length && def.note) d = { ...d, note: def.note };
  return d;
}
export function reportWindow(d: Dataset, bundle: Bundle) {
  if (d.grain.includes('snapshot') || !d.rows.some((r) => r.date)) return d;
  const end = Date.parse(bundle.generatedAt.slice(0, 10));
  const cutoff =
    d.grain === 'month'
      ? Date.parse(bundle.generatedAt.slice(0, 7) + '-01')
      : end;
  const start = cutoff - (d.grain === 'month' ? 730 : 90) * 86400000;
  // Report comparisons exclude the current UTC date; source day boundary remains disclosed as unverified.
  return {
    ...d,
    rows: d.rows.filter(
      (r) =>
        r.date &&
        Date.parse(String(r.date)) >= start &&
        Date.parse(String(r.date)) < cutoff,
    ),
  };
}
export const detailColumns: Record<string, string[]> = {
  cex_exchange_comparison: [
    'entity',
    'spotVolumeUsd',
    'spotAsOf',
    'futuresVolumeUsd',
    'futuresAsOf',
    'reservesUsd',
    'reservesAsOf',
    'stocksVolumeUsd',
    'stocksVolumeAsOf',
    'stocksOiUsd',
    'stocksOiAsOf',
  ],
  funding_arbitrage: [
    'entity',
    'buyExchange',
    'sellExchange',
    'buyFundingRate',
    'sellFundingRate',
    'buyIntervalHours',
    'sellIntervalHours',
    'sourceApr',
  ],
  tradfi_exchange_comparison: [
    'entity',
    'volumeUsd',
    'oiUsd',
    'fundingRate',
    'premiumPct',
    'focusHits',
  ],
  tradfi_stock_funding: ['date', 'entity', 'exchange', 'sourceRate'],
  tradfi_arbitrage: [
    'entity',
    'sector',
    'referenceVenue',
    'referenceSymbol',
    'referencePrice',
    'referenceAsOf',
    'referenceStale',
    'sourceBestNetPremiumPct',
  ],
  hl_dex_totals_snapshot: [
    'entity',
    'quote_symbol',
    'asset_count',
    'volume_24h_usd',
    'oi_usd_mark',
  ],
  hl_markets_snapshot: [
    'entity',
    'dex',
    'quote_symbol',
    'mark_price',
    'volume_24h_usd',
    'oi_usd_mark',
    'funding_hourly',
  ],
};
export function tableColumns(d: Dataset) {
  const all = Array.from(new Set(d.rows.flatMap((r) => Object.keys(r))));
  return Array.from(
    new Set([
      ...(detailColumns[d.id] || ['date', 'entity', ...d.measures]),
      ...all,
    ]),
  ).filter((k) => all.includes(k));
}
export function tableHeading(
  d: Dataset,
  k: string,
  label: (k: string) => string,
) {
  const unit = d.rows.some((r) => numeric(r[k])) ? columnUnit(d, k) : '';
  return label(k) + (unit ? ' (' + unit + ')' : '');
}
export function reportManifest(bundle: Bundle) {
  const sections = reportSections();
  const ids = Array.from(
    new Set(
      sections.flatMap((s) => s.panels.flatMap((p) => dependencyIds(p.id))),
    ),
  );
  return {
    version: reportVersion,
    snapshotId: bundle.snapshotId,
    generatedAt: bundle.generatedAt,
    routes: 13,
    sections: sections.length,
    panels: sections.reduce((n, s) => n + s.panels.length, 0),
    sectionKeys: sections.map((s) => s.path + '#' + s.view),
    datasetIds: ids,
    dayWindow: 90,
    monthWindow: 24,
    allSourceRecords: false,
    sourceDatasets: bundle.datasets.length,
    detailDatasets: Object.keys(detailColumns),
    sectors: getDataset(bundle, 'tradfi_labels').rows.map((r) =>
      String(r.entity),
    ),
  };
}

export function constantColumns(d: Dataset) {
  return tableColumns(d).filter(
    (k) => d.rows.length > 0 && d.rows.every((r) => r[k] === d.rows[0][k]),
  );
}
export function tableGroups(d: Dataset) {
  const constants = new Set(constantColumns(d));
  const columns = tableColumns(d).filter((k) => !constants.has(k));
  const ids = ['entity'].filter((k) => columns.includes(k));
  const fields = columns.filter((k) => !ids.includes(k));
  const size = 7 - ids.length,
    groups: string[][] = [];
  for (let i = 0; i < fields.length; i += size)
    groups.push([...ids, ...fields.slice(i, i + size)]);
  return groups.length ? groups : [ids];
}
