# 原站范围与数据可获取性审计

审计日期：2026-09-14～2026-09-15（Asia/Shanghai；取样于14日夜间，文档于15日完成）。状态：只读调研；没有安装插件、注册服务、开发网站、创建 GitHub 仓库或启用定时任务。

## 范围与证据层级

本报告仅覆盖用户指定的 CEX、DEX（原站导航名称“去中心化”）、代币化股票、Hyperliquid。CEX 网站流量与期权、DEX UNI Burn 已获用户明确排除。新增 DEX 市场份额是用户明确要求。其他不自行增删。

- **页面结构已实测**：实时取得公开 HTML 或其明确加载的 JavaScript；能证明原站页面存在该结构，不等于数据接口可用。
- **数据响应已实测**：对页面明示的公开数据端点作少量只读请求；能证明抽样时可读，不证明未来持续可读、数据正确、或者可再发布。
- **待验证**：失败、尚未请求，或仅从文档/页面说明得知；不计作数据接入完成。

首页搜索抓取缓存停留于 2026 年 7 月，实时 HTML 已出现 2026-09-14 的内容。本报告以实时响应为准，不以搜索缓存日期证明数据新鲜度。

## 原有页面结构保留基线

| 组 | 页面与原链接 | 已确认的页内结构/控件 | 数据核验状态 |
|---|---|---|---|
| CEX | [交易所对比](https://data.wublock123.com/dashboard/exchanges) | 完整实时内页已取得：交易所总览表（现货、合约、储备、TradFi成交/持仓）；现货/合约成交额份额；储备份额；TradFi板块跨所对比（成交、持仓、费率、指数溢价、焦点标的）；跨所费率套利。期权表/列/入口按用户指令排除。 | 重试后实时HTML成功，含最新快照；部分份额明确数据截至2026-09-13 |
| CEX | [交易所有效成交量](https://data.wublock123.com/dashboard/exchange_volume) | 日度/月度切换；交易所筛选；现货成交、合约成交、合约/现货比值；日/月现货与合约市场份额。页面脚本定义市场份额为所收录样本交易所之和，排除 ALL/Total | 脚本已实测，数据响应见后文 |
| CEX | [CEX 储备](https://data.wublock123.com/dashboard/cex-assets) | 两个 tab：储备资产趋势、储备可信度；前者有总资产/份额趋势；后者有总览/交易所明细/评分方法、搜索、维度排序、披露×托管散点、资产规模对数/线性轴、手动更新 | HTML及脚本已实测；评分是原站作者研究模型，非客观API字段，见质量边界 |
| CEX | [合约持仓](https://data.wublock123.com/dashboard/futures) | 3区：①持仓历史（交易所、交易对/币种、1h/4h/1d、刷新、最新值、点数）；②全市场聚合持仓历史（稳定币本位+币本位合计，币种、1h/4h/1d）；③保证金历史（币种、1h/4h/1d、U本位/币本位） | 重试后实时HTML成功；实际数据序列待核验 |
| CEX | [资金费率](https://data.wublock123.com/dashboard/funding) | ①交易所交易对费率：交易所、交易对、15分钟/1小时/4小时/1天/1周、刷新、序列数、数据点、Z-Score；②聚合费率：币种、1小时/4小时/1天、持仓加权/成交量加权、刷新、最新值与Z-Score；③资金费率套利机会：交易所筛选、最小APR、刷新。初始显示 Binance/OKX/Bybit、10,000 USD、最多10条 | HTML已实测；实际序列与套利响应待核验。默认参数不代表应原样使用为产品假设 |
| CEX | [币种聚合成交量](https://data.wublock123.com/dashboard/aggregated_volume) | 现货与合约两区；维度为币种/标签；币种筛选；1小时/4小时/1天；刷新；最新聚合成交量、最新收盘价、数据点数、图表 | HTML已实测；实际序列待核验 |
| DEX | [Robinhood Chain](https://data.wublock123.com/dashboard/robinhood-chain) | 4 tabs：链上概览、DEX、Meme Launchpad、RWA/币股。链上概览含日交易笔数+7日移动平均、日活地址（新增/回访）。页头还明确 DEX成交、RWA市值、币股成交量 | HTML已实测。脚本已实测，所有4个tab结构与字段见下文；抽样接口响应另列 |
| DEX | 去中心化交易所市场份额（新增） | 用户新增需求，不是原站现有结构证据；现货 DEX 与永续 DEX 必须分开口径、分母和排序 | 上游可获取性由来源审计另行记录。Robinhood专题不可据导航归类直接算入DEX份额分母 |
| 代币化股票 | [热门板块](https://data.wublock123.com/dashboard/tradfi) | Stocks为默认分类；分类下拉与“全部分类”纵向视图；每类有成交图、交易所对比、持仓Top、极端费率、标记/指数价格溢价、交易对/交易所拆分；1h/4h/1d/1w/1m/1y选择、刷新、覆盖/缺失数和更新时间 | 不能将“代币化股票”导航等同于严格的链上股票代币现货，也不能自行删除原页商品/外汇分类 |
| 代币化股票 | [TradFi 套利](https://data.wublock123.com/dashboard/tradfi-spot-arb) | 导航和实时HTML已确认路由tradfi-spot-arb；Stocks/Commodities/Indices筛选、跨所报价矩阵、溢价+一期funding、排序、年龄与过期标记；见下文 | 发现明显需核对的异常价差，见质量边界 |
| 代币化股票 | [稳定币市值](https://data.wublock123.com/dashboard/stablecoin-marketcap) | 按公链与按稳定币的市值趋势，两类折线图；原页说明最近180个点 | HTML已实测；历史接口与范围另行确认 |
| Hyperliquid | [Hyperliquid](https://data.wublock123.com/dashboard/hyperliquid) | 7 tabs：概览、费用、按类别、按市场、按资产、HIP-4、HyperEVM DEX；页头说明 HIP-3/HIP-4 交易量、持仓量、按类别/市场/资产分解、市场份额，来源 Dune/ASXN、日度 | HTML已实测；7个tab的实际字段已由脚本核验，见下文；抽样历史响应另列 |

页面结构完整率与数据就绪率必须分开。12 个专题路由齐全，不等于 12 个专题内所有 tab、筛选、表格和图表都有真实数据。

## 页面脚本明确引用的公开数据

交易所有效成交量页面脚本 `/_next/static/chunks/app/dashboard/exchange_volume/page-a33b9791605a419b.js` 已读取，明确 fetch 以下文件：

- `/json/cex-asset-vol/cex_exchange_daily_spot_volume_usd.json`
- `/json/cex-asset-vol/cex_exchange_daily_futures_volume_usd.json`
- `/json/cex-asset-vol/cex_exchange_daily_futures_spot_ratio.json`
- `/json/cex-asset-vol/cex_exchange_monthly_spot_volume_usd.json`
- `/json/cex-asset-vol/cex_exchange_monthly_futures_volume_usd.json`

字段名中的 USD 以及页面单位可证明原站表达为美元成交额，不能证明它已经排除虚假成交。页面标题中的“有效/真实”不构成可独立验证的方法论。

## 质量与再发布边界

1. 原站实时首页出现 Stocks/BMNR 约 +58.4%、CL 约 +64.5%、US500 约 +915.0% 的跨所价差示例。这只是原站展示值，不是我们验证的套利机会。必须核对资产身份、产品类型、价格币种、合约乘数、交易时间和报价时间；不满足可比性就不计算价差或AI结论，保留“口径待核验”。
2. 原站“CEX”成交/储备摘要中也出现 Hyperliquid。复制导航不应把 Hyperliquid 错标为中心化交易所。市场份额必须声明收录集合和分类规则。
3. 原站脚本市场份额分母是样本交易所成交额，不能标成“全球市场份额”。
4. 原站 exchange_volume 脚本存在用浏览器 `new Date().toLocaleDateString()` 填充“最后更新”的逻辑。新站必须从数据日期/源更新时间/采集时间单独获取，不把访问时间当源更新日期。
5. 公开无需登录可读，不等于有再发布授权。尚未取得原站或上游适用于公开网站的明确许可/条款证据；原站端点应先用于对照与核验，不能据此默认成为网站的长期生产后端。
6. 保留“待接入/数据暂缺”；不以随机数据、静态演示数据或不等价指标冒充真实接入。任何缩减tab/分类或新增非用户要求内容均需用户确认。

## 数据响应抽样结果（2026-09-14 实测）

本轮只对每组少量页面明示数据端点取响应，不遍历历史分片、不扫隐藏接口、不执行付费上游查询。行数和日期范围仅指本次返回值，不承诺每个实体覆盖整个区间。

| 样本 | 成功响应与颗粒度 | 历史/时点 | 关键边界 |
|---|---|---|---|
| [交易所现货日成交](https://data.wublock123.com/json/cex-asset-vol/cex_exchange_daily_spot_volume_usd.json) | `code=0`；1403行；`date × exchange → USD volume`；16个具名场所列+ALL（含Hyperliquid、Uniswap） | 2022-11-11～2026-09-13；`generated_at=2026-09-13T22:39:05Z` | 元数据称来自合并的xlsx/csv和旧JSON；不是官方交易所API的原生响应。可比实体分类与0/null含义须重新验证 |
| [交易所合约月成交](https://data.wublock123.com/json/cex-asset-vol/cex_exchange_monthly_futures_volume_usd.json) | `code=0`；45行；`month × exchange → USD volume`；14个具名场所+ALL | 2022-11～2026-08；`generated_at=2026-09-13T22:39:06Z` | 返回完整月截止8月；9月无值不应误报过期。新站不得把月度合计当24h成交 |
| [热门板块分类目录](https://data.wublock123.com/api/coinglass/futures/tradfi-volume-overview?source=tag&labels_only=1) | `code="0"`；`available_labels[{name,pair_count}]`；28类 | 单次目录快照，无源更新时间 | Stocks=2159、Commodities=100、Indices=96，pair_count 是页面目录的交易对数量，不是去重公司数/股票代币数。目录不是成交历史核验 |
| [稳定币历史](https://data.wublock123.com/api/coinglass/index/stableCoin-marketCap-history) | `code="0"`；3211日；`time`+总市值+11个币种/币种组合字段+15条链字段，页面按USD表达 | 2017-11-29～2026-09-13；响应未提供独立generated_at | `all_usds/dai`是合并字段；早期并非全部系列都有值。总量与链细分不应假定无遗漏且严格相等；不可把币种×链交叉明细当已获得 |
| [Robinhood日交易](https://data.wublock123.com/api/robinhood-chain/daily_transactions) | `code="0"`；`day, transactions`；75行；来源[query7915115](https://dune.com/queries/7915115) | 2026-06-30～2026-09-12；源执行结束9/13 18:02:47 UTC；缓存更新9/13 22:33:50 UTC | `executed_by_us=false`，是原站读取已执行查询结果；本轮未执行Dune query。链/网络真实性需对照原SQL，不只依赖原站命名 |
| [Robinhood DEX成交](https://data.wublock123.com/api/robinhood-chain/dex_volume) | `code="0"`；1299行；`day × dex → volume_usd`；75日、20个协议版本；来源[query7915153](https://dune.com/queries/7915153) | 2026-06-30～2026-09-12；源执行9/13 19:03:13 UTC；缓存更新9/13 22:33:55 UTC | “20”含Uniswap v2/v3/v4等版本，不是20个独立品牌。不同版本归并、聚合器与底层DEX双计数必须核对 |
| [Hyperliquid HIP-3概览](https://data.wublock123.com/api/hyperliquid/hip3_overview) | `code="0"`；334日；`time, Daily Volume, Open Interest, Cum. Volume`；来源[query8077142](https://dune.com/queries/8077142) | 2025-10-13～2026-09-11；缓存更新时间9/13 22:33:31 UTC | 最新数据日落后于缓存更新时间；页面用USD，响应本身未带币种元字段；不是整个Hyperliquid所有业务的总量 |
| [Hyperliquid HIP-4](https://data.wublock123.com/api/hyperliquid/hip4) | `code="0"`；122日；`Day, Volume, Trades, Active Markets, Yes Volume, No Volume, Network, Window, Bucket Ms, Bucket Start UTC`；来源[query8077860](https://dune.com/queries/8077860) | 2026-05-03～2026-09-01；缓存更新时间2026-09-02；Network=`mainnet`、Window=`all`、bucket=86400000ms | 本次已明显过期；即使接口成功也不能标“今日更新”。`Volume`原始字段不带币种；需对照SQL/官方定义后采用USD |

稳定币细分字段：FDUSD、PYUSD、RLUSD、TUSD、USD1、USDC、USDD、USDE、USDG、USDS/DAI、USDT；链字段：Aptos、Arbitrum、Avalanche、Base、BSC、Ethereum、Hyperliquid L1、Mantle、OP Mainnet、Plasma、Polygon、Solana、TON、Tron、X Layer。只是已读字段清单，不代表应额外新增相应独立页面。

热门板块完整目录（原站本次返回）：Stocks；Layer 1 (L1)；Decentralized Finance (DeFi)；Binance Alpha Spotlight；Made in USA；Meme；Artificial Intelligence (AI)；Proof of Work (PoW)；NFT；Decentralized Exchange (DEX)；Layer 2 (L2)；Real World Assets (RWA)；World Liberty Financial Portfolio；Gaming (GameFi)；Zero Knowledge (ZK)；DePIN；Commodities；Privacy；Indices；Alleged SEC Securities；Wallets；SocialFi；Storage；Centralized Exchange (CEX) Token；Stablecoins；Stock market-themed；Prediction Markets；Chinese Meme。客户端明确将标签 `TradFi/Forex/Metals` 重定向 Stocks。

**待用户决策**：保持热门板块全部28类（保留原页默认Stocks），还是收窄至 Stocks/Commodities/Indices？后者有助于专题聚焦，但属于删改，未获确认前不得执行。目录名称本身只是来源分类标签，不应当作我们对项目属性的独立认定。

## 全部页内组件与字段补充

### Robinhood Chain（4 tabs保留）

| tab | 指标/图表 | 脚本明示维度与字段 | 来源/核验 |
|---|---|---|---|
| 链上概览 | 日交易+7日均线；日活新/回访堆叠与份额 | `day,transactions`；`day,wallet_type,wallets` | query7915115已抽样；query7916628仅脚本明确 |
| DEX | DEX日成交堆叠/比例；累计成交占比 | `day,dex,volume_usd`；原页Top8，其余合并 | query7915153已抽样；是Robinhood链内份额，不是新增全市场DEX页 |
| Meme Launchpad | 每日新发币；成交额/交易笔数/活跃交易者切换；累计占比 | `day,launchpad,tokens_launched`；`day,launchpad,volume_usd,trades,wallets` | query7916783、8024180；仅脚本明确。原脚本对单日成交额>1e9作异常排除，不能未验证就照搬阈值 |
| RWA/币股 | 分类RWA市值；分类币股成交；份额 | `block_date,asset_class,aum_usd`；`block_date,series,volume_usd` | query8073404、8071940；仅脚本明确。原页分类含股票、ETF、商品、国债，以及Meme×股票交易对；需保留身份区别 |

脚本端点均位于 `/api/robinhood-chain/`，suffix为`daily_transactions,active_wallets,dex_volume,launchpad_new_tokens,launchpad_activity,rwa_aum,rwa_volume`。除此未猜测新端点。

### Hyperliquid（7 tabs保留）

| tab | 原有组件 | 数据维度/边界 | 核验 |
|---|---|---|---|
| 概览 | HIP-3日成交柱+OI线+累计成交；HIP-3 vs Crypto成交/OI与份额 | `hip3_overview`、`hip3_and_crypto`；日度，USD | 前者已抽样；后者脚本已见 |
| 费用 | 日fees/revenue/隐含费率；Core/HIP-3成交拆分；HyperEVM链上费用 | `hl_fees_daily`与`hl_volume_split`；费用USD、费率bps。来源说明为DefiLlama fees/revenue+Dune成交/链费 | 脚本已见；历史完整性未抽样，不能用固定费率推算为真实手续费 |
| 按类别 | HIP-3类别日成交；整个HL类别日成交；金额/占比切换 | `hip3_by_category`与`hl_by_category`，Category | 仅脚本；两张图总体不同，不可混用 |
| 按市场 | 各部署市场日成交与OI，金额/占比切换 | `hip3_by_market`，Market、Daily Volume、Open Interest | 仅脚本 |
| 按资产 | 最新日TopN资产成交，数量/类别筛选，单资产历史成交+OI | `symbol?view=categories/symbols/latestTop/series`；资产标识需保留部署市场命名空间 | 仅脚本；不能假定每个symbol都完整回填 |
| HIP-4 | 日成交/交易笔数/活跃市场数/Yes-No成交 | `hip4`；日度、网络、bucket | 已抽样，最后数据9/1，须过期提示 |
| HyperEVM DEX | 各DEX日成交；交易笔数/交易地址数 | `hyperevm_dex`；按日、DEX | 仅脚本。原页说明地址是各DEX分别去重后相加，同一地址跨DEX会重复；不能标全链去重用户 |

### CEX 特殊口径

- 交易所对比页面本轮实时HTML成功，提供约17个混合场所/品牌的汇总行，现货/合约/储备份额截至9月13日；同时有TradFi焦点标的汇总和费率套利。用户删除期权意味着其期权列、卡片、图表和入口一并排除，而非只隐藏一级导航。
- 资金费率脚本明示实时多所费率端点、交易对目录与资金费率套利端点；聚合费率引用本地OI/成交量加权文件。只读目录和响应可行性不能证明这些依赖上游CoinGlass的项可以免费长期获取。
- 合约持仓脚本明示本地分交易所持仓历史与聚合持仓API，U本位/币本位部分的底层名称为 `open-interest-aggregated-stablecoin-history / coin-margin-history`。页面称“保证金”的内容可能实际是按保证金币种分类的OI，必须逐项查源定义，不能误当客户实际抵押保证金。
- 聚合成交量脚本明示 `/api/coinglass/{spot|futures}/aggregated-volume-history`，传symbol/interval/limit=4500；这只能证明页面最大请求参数，不证明每个symbol均有4500点。tag聚合会遍历分类资产并合并，分类重叠不能跨类直接相加。
- 储备可信度：原页作者研究快照（2026-08-02）设定披露D/托管C/稳定S权重55/25/20，研究分统一乘0.85为展示分，部分缺失项以样本中位数补齐；含19家独立品牌、手工安全事件/恢复事件与披露证据。这不是可直接获取的通用“信用分API”。公开资产规模还混合链上可识别资产与上市公司披露的平台资产，原脚本有区别标记。
- **待用户确认**：保留储备可信度tab，但第一版先标“研究口径待确认”；是否另建自有研究模型属于新内容，需要单独确认。不得把原作者评分当自有原创，不得将评分描述为偿付保证。

### TradFi 套利（完整实时HTML已实测）

原页有“全部板块/Stocks/Commodities/Indices”筛选、按绝对净边降序/标的名排序、跨所报价矩阵、参考交易所与参考价、每个交易对的一期funding、快照年龄和过期标记。当前HTML说明78标的、11交易所，快照时间2026-09-11 20:30:50（渲染文本未明确时区），刷新周期3600秒。

原页比较 Yahoo 股票/期货参考价与加密交易所永续价格，将价格差与一期资金费率相加；表内默认统一8h，未扣交易费用与滑点。页面自己提示剔除了5个因代码映射错误产生的±50%以上报价。这说明“能够读取”与“可以用来决策”之间仍有明确验证工作。

产品Spec必须分别存储价格溢价与funding，不自动使用全市场统一8h，也不把两者之和直接称可实现收益。Yahoo参考价公开再发布与自动使用权尚未证实；免费公开网站第一版不能默认以非官方Yahoo抓取为稳定授权来源。取得同身份参考价之前保留位置与缺失说明，不自行改成另一套“套利”。

## 本轮结论

技术上可以读取原站四组的页面结构和多种结构化历史数据；最有力证据是两份CEX成交历史、稳定币历史、Robinhood日交易/DEX历史、HIP-3/HIP-4历史的成功响应。公开网站的生产数据方案仍必须以明确可用的免费上游和可解释口径为准。

尚未验证的关键项：原站/上游公开再发布许可、所有子图完整历史、CoinGlass高阶项免费替代的覆盖、Dune查询SQL/网络身份和免费刷新成本、Yahoo参考价许可与标的映射、储备评分是否需要保留原研究内容。它们应进入PRD/Spec的待确认和数据接入状态，不算已完成模块。
