export type PanelDef = {
  id: string;
  title: string;
  subtitle?: string;
  mode?: 'chart' | 'rank' | 'table';
  measure?: string;
  full?: boolean;
  note?: string;
};
export type ViewDef = { name: string; panels: PanelDef[] };
export type PageDef = {
  path: string;
  group: string;
  title: string;
  description: string;
  views: ViewDef[];
};
const p = (
  id: string,
  title: string,
  extra: Partial<PanelDef> = {},
): PanelDef => ({ id, title, ...extra });
export const pages: PageDef[] = [
  {
    path: '/cex/compare',
    group: 'cex',
    title: '交易所对比',
    description: '从成交额、储备与持仓观察交易所竞争格局。',
    views: [
      {
        name: '综合对比',
        panels: [
          p('cex_exchange_comparison', '交易所综合对比', {
            mode: 'table',
            full: true,
          }),
          p('cex_spot_daily', '现货成交额排名', { mode: 'rank' }),
          p('cex_futures_daily', '合约成交额排名', { mode: 'rank' }),
          p('cex_reserves_daily', '储备资产对比', { mode: 'rank', full: true }),
        ],
      },
    ],
  },
  {
    path: '/cex/volume',
    group: 'cex',
    title: '交易所成交量',
    description: '按交易所跟踪现货与合约成交额，保留日频和月频口径。',
    views: [
      {
        name: '每日成交量',
        panels: [
          p('cex_spot_daily', '现货成交额'),
          p('cex_futures_daily', '合约成交额'),
          p('cex_spot_daily_share', '现货成交额 · 样本份额'),
          p('cex_futures_daily_share', '合约成交额 · 样本份额'),
          p('cex_futures_spot_ratio_daily', '同平台合约 / 现货比', {
            full: true,
          }),
        ],
      },
      {
        name: '每月成交量',
        panels: [
          p('cex_spot_monthly', '月度现货成交额'),
          p('cex_futures_monthly', '月度合约成交额'),
          p('cex_spot_monthly_share', '月度现货 · 样本份额'),
          p('cex_futures_monthly_share', '月度合约 · 样本份额'),
          p('cex_futures_spot_ratio_monthly', '同平台月度合约 / 现货比', {
            full: true,
          }),
        ],
      },
    ],
  },
  {
    path: '/cex/reserves',
    group: 'cex',
    title: '交易所储备',
    description: '跟踪公开披露的资产储备；储备资产不代表净资产或偿付能力。',
    views: [
      {
        name: '储备资产',
        panels: [
          p('cex_reserves_daily', '储备资产趋势', { full: true }),
          p('cex_reserves_daily', '储备资产排名', { mode: 'rank' }),
          p('cex_reserves_daily_share', '储备资产 · 样本份额'),
          p('cex_reserve_score', '储备可信度评分', {
            note: '评分方法和证据标准待确认，不复制原作者主观评分。',
          }),
        ],
      },
    ],
  },
  {
    path: '/cex/open-interest',
    group: 'cex',
    title: '合约持仓量',
    description: '观察未平仓合约规模，按资产与保证金币种分别呈现。',
    views: [
      {
        name: '聚合持仓',
        panels: [
          p('futures_oi_btc', 'BTC 聚合持仓量'),
          p('futures_oi_eth', 'ETH 聚合持仓量'),
        ],
      },
      {
        name: '单交易对',
        panels: [
          p('futures_oi_exchange_btc', 'Binance · BTCUSDT 持仓量', {
            full: true,
          }),
        ],
      },
      {
        name: '保证金历史',
        panels: [
          p('futures_oi_stablecoin_btc', '稳定币保证金合约 OI'),
          p('futures_oi_coin_btc', '币本位保证金合约 OI'),
        ],
      },
    ],
  },
  {
    path: '/cex/funding',
    group: 'cex',
    title: '资金费率',
    description: '比较资金费率与结算周期；未核验单位的来源数值单独标记。',
    views: [
      {
        name: '单交易对',
        panels: [
          p('funding_btc', 'Binance · BTCUSDT 资金费率', { full: true }),
        ],
      },
      {
        name: '加权费率',
        panels: [
          p('funding_oi_btc', 'OI 加权资金费率'),
          p('funding_vol_btc', '成交量加权资金费率'),
        ],
      },
      {
        name: '资金费率套利',
        panels: [
          p('funding_arbitrage', '跨交易所费率观察', {
            mode: 'table',
            full: true,
          }),
        ],
      },
      {
        name: 'Z-score',
        panels: [
          p('funding_zscore', '资金费率 Z-score', {
            note: '保留单交易对与聚合两类 Z-score；标准化窗口、时区与结算周期统一后分别接入。',
          }),
        ],
      },
    ],
  },
  {
    path: '/cex/aggregated-volume',
    group: 'cex',
    title: '聚合成交量',
    description: '按标的观察全样本成交活跃度，现货与合约分别统计。',
    views: [
      {
        name: 'BTC',
        panels: [
          p('spot_volume_btc', 'BTC 现货聚合成交额'),
          p('futures_volume_btc', 'BTC 合约聚合成交额'),
        ],
      },
      {
        name: '其他资产',
        panels: [
          p('aggregated_other', '其他资产聚合成交量', {
            note: '当前已取得 BTC 日频历史。原有其他币种/标签、1h/4h 等粒度保留范围，尚未逐项接入核验。',
          }),
        ],
      },
    ],
  },
  {
    path: '/dex/market-share',
    group: 'dex',
    title: 'DEX 市场份额',
    description: '现货 DEX 与永续 DEX 分开比较，份额分母采用完整可比样本。',
    views: [
      {
        name: '现货 DEX',
        panels: [
          p('dex_spot_market_share', '现货 DEX 市场份额', { full: true }),
        ],
      },
      {
        name: '永续 DEX',
        panels: [
          p('dex_perp_market_share', '永续 DEX 市场份额', { full: true }),
        ],
      },
    ],
  },
  {
    path: '/dex/robinhood-chain',
    group: 'dex',
    title: 'Robinhood Chain',
    description: '跟踪链上活跃、去中心化交易与 RWA 资产。',
    views: [
      {
        name: '链上概览',
        panels: [
          p('rh_daily_transactions', '每日交易笔数'),
          p('rh_daily_transactions_ma7', '交易笔数 · 7 日均线'),
          p('rh_active_wallets', '活跃钱包'),
          p('rh_active_wallets_share', '新增 / 回访钱包构成'),
        ],
      },
      {
        name: 'DEX',
        panels: [
          p('rh_dex_volume', 'DEX 日成交额', { full: true }),
          p('rh_dex_volume_share', 'DEX 来源记录构成', {
            full: true,
            note: '来源包含路由和执行协议，去重待核；缺报日不计算完整份额，不称全行业市场份额。',
          }),
        ],
      },
      {
        name: 'Meme Launchpad',
        panels: [
          p('rh_launchpad_new_tokens', '每日新发行代币'),
          p('rh_launchpad_activity', 'Launchpad 成交额'),
        ],
      },
      {
        name: 'RWA 币股',
        panels: [
          p('rh_rwa_aum', 'RWA 资产规模'),
          p('rh_rwa_aum_share', 'RWA 资产分类构成'),
          p('rh_rwa_volume', 'RWA 成交额'),
          p('rh_rwa_volume_share', 'RWA 成交额构成'),
        ],
      },
    ],
  },
  {
    path: '/tokenized-stocks/sectors',
    group: 'stocks',
    title: '热门板块',
    description:
      '保留原站 28 个板块目录；股票相关产品需区分现货代币与永续合约。',
    views: [
      {
        name: '板块概览',
        panels: [
          p('tradfi_stocks', '股票板块成交额'),
          p('tradfi_stock_assets', '股票标的成交额'),
          p('tradfi_stock_exchanges', '交易所股票成交额'),
          p('tradfi_stock_oi_assets', '股票标的持仓量'),
        ],
      },
      {
        name: '交易所对比',
        panels: [
          p('tradfi_exchange_comparison', '交易所综合数据', {
            mode: 'table',
            full: true,
          }),
          p('tradfi_stock_oi_exchanges', '交易所股票持仓量'),
        ],
      },
      {
        name: '资金费率',
        panels: [
          p('tradfi_stock_funding', '股票产品资金费率', {
            mode: 'table',
            full: true,
          }),
        ],
      },
    ],
  },
  {
    path: '/tokenized-stocks/arbitrage',
    group: 'stocks',
    title: 'TradFi 套利观察',
    description: '保留参考市场与加密市场的价格对照；价格偏离不等于可实现利润。',
    views: [
      {
        name: '价格对照',
        panels: [
          p('tradfi_arbitrage', '跨市场报价与溢价', {
            mode: 'table',
            full: true,
          }),
        ],
      },
    ],
  },
  {
    path: '/tokenized-stocks/stablecoins',
    group: 'stocks',
    title: '稳定币市值',
    description: '按币种和链查看规模；两种维度存在重叠，不能合并相加。',
    views: [
      {
        name: '按币种',
        panels: [p('stablecoin_marketcap', '稳定币市值趋势', { full: true })],
      },
      {
        name: '按链',
        panels: [
          p('stablecoin_marketcap', '各链稳定币规模', {
            mode: 'rank',
            full: true,
          }),
        ],
      },
    ],
  },
  {
    path: '/hyperliquid',
    group: 'hl',
    title: 'Hyperliquid',
    description: '连接 HyperCore、HIP-3 和 HyperEVM，观察交易与生态变化。',
    views: [
      {
        name: '概览',
        panels: [
          p('hl_hip3_and_crypto', 'HIP-3 与 Crypto 成交额'),
          p('hl_hip3_and_crypto_share', 'HIP-3 / Crypto 成交额构成'),
          p('hl_hip3_and_crypto_oi', 'HIP-3 与 Crypto 持仓量'),
          p('hl_hip3_and_crypto_oi_share', 'HIP-3 / Crypto 持仓构成'),
          p('hl_hip3_overview', 'HIP-3 成交额与持仓'),
          p('hl_dex_totals_snapshot', '官方市场快照', {
            mode: 'table',
            full: true,
          }),
        ],
      },
      {
        name: '费用',
        panels: [
          p('hl_fees_daily', 'Hyperliquid 每日费用', { full: true }),
          p('hl_volume_split', 'Core 与 HIP-3 成交额'),
        ],
      },
      {
        name: '按类别',
        panels: [
          p('hl_by_category', '全市场类别成交额'),
          p('hl_by_category_share', '全市场类别成交额构成'),
          p('hl_hip3_by_category', 'HIP-3 类别成交额'),
          p('hl_hip3_by_category_share', 'HIP-3 类别成交额构成'),
        ],
      },
      {
        name: '按市场',
        panels: [
          p('hl_hip3_by_market', 'HIP-3 部署市场成交额', { full: true }),
          p('hl_hip3_by_market_share', '部署市场成交额构成'),
          p('hl_hip3_by_market_oi_share', '部署市场持仓构成'),
        ],
      },
      {
        name: '按资产',
        panels: [
          p('hl_symbol_latest', '资产成交额排名', { mode: 'rank' }),
          p('hl_symbol_series', '资产成交额历史'),
          p('hl_markets_snapshot', '官方资产快照 · Top 200', {
            mode: 'table',
            full: true,
          }),
        ],
      },
      {
        name: 'HIP-4',
        panels: [p('hl_hip4', 'HIP-4 活跃与成交量', { full: true })],
      },
      {
        name: 'HyperEVM DEX',
        panels: [p('hl_hyperevm_dex', 'HyperEVM DEX 成交额', { full: true })],
      },
    ],
  },
];
export const groups = [
  { id: 'overview', name: '总览', path: '/' },
  { id: 'cex', name: 'CEX', path: '/cex/compare' },
  { id: 'dex', name: 'DEX', path: '/dex/market-share' },
  { id: 'stocks', name: '代币化股票', path: '/tokenized-stocks/sectors' },
  { id: 'hl', name: 'Hyperliquid', path: '/hyperliquid' },
];
