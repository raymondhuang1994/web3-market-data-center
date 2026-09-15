import type { PanelDef } from './catalog.ts';
export const sectorViews = ['板块概览', '交易所对比', '资金费率'];
export function sectorPanels(sector: string, view: string): PanelDef[] {
  const id = 'sector_' + sector;
  if (view === '资金费率') return [{ id: id + '_funding', title: sector + ' · 资金费率', mode: 'table', full: true }];
  if (view === '交易所对比') return [
    { id: id + '_exchanges', title: sector + ' · 交易所日成交额' },
    { id: id + '_oi_exchanges', title: sector + ' · 交易所持仓历史' },
  ];
  return [
    { id, title: sector + ' · 板块日成交额' },
    { id: id + '_assets', title: sector + ' · 标的日成交额' },
    { id: id + '_exchanges', title: sector + ' · 交易所日成交额' },
    { id: id + '_oi_assets', title: sector + ' · 标的持仓历史' },
  ];
}
