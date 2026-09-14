# Source registry 逐项研究补充（仅本地只读证据）

审计日期：2026-09-15（Asia/Shanghai）。本报告没有运行采集器、访问新接口、安装服务或修改站点；仅写入本临时 Markdown，供主代理整合。按 data-analytics:analyze-data-quality 的粒度、时效、完整性、唯一性和口径检查整理。

## 结论与时间边界

- 证据基线是 `data/bootstrap.json`，generatedAt=2026-09-14T16:26:28.824853+00:00（北京时间 2026-09-15T00:26:28+08:00），不是本轮线上 API 快照或今天定时任务成功证据。SHA256：`901e96ea51025e920e9166dfa78ac7327c9ddfd6f11197a04b559811ab48299b`。
- 原始 49 个数据集：45 有行、4 个占位；保存状态 ready16 / stale17 / review12 / pending4。状态是生成时的标签，不能在审计日无计算地当实时状态。
- 45 个有行的数据集中，43 个经 `data.wublock123.com` 提供，只有 2 个直连 Hyperliquid 官方；43 个依赖同域名，不代表 43 个独立来源。
- 49 之外还有 2 个数据 UI 占位、27 个板块历史占位，即 78 个数据登记项；另有 1 个 AI 内容组件。实施中新增 7 个派生数据 ID 可另登为 85 个数据项 + 1 个 AI 内容项。以上是资产清单数量，**不是 PRD 关键组件覆盖分母**，不能据此计算已完成 45/49 或 45/85。
- 重点需用户决定的仍是评分方法、受限 DEX/费用来源与永续付费源，以及是否保留长期待接入项；已有数据但单位待核、样本少、上游旧，不应写成“完全拿不到”。
- 新发现：Stocks OI 源元数据 pair_count=2159、success_count=1803、missing_count=0 未闭合，差 356。不能用 missing_count=0 声称 OI 交易对全覆盖。
- 最新日 K 完整性仅能说“待核验”：若请求返回当日日期但未给 periodComplete / bucket watermark，不能只凭日期认定已完结，也不能认定一定是错数据。

## 来源层级、可靠性与时钟的登记规则

- L1：项目直连官方数据服务（本次仅 Hyperliquid 两个快照）。官方直连提升可追溯性，不保证所有单位、币种换算和使用条件已核实。
- L2：原站结构化公开聚合/缓存。已取得字段与上游 metadata 可作为证据，不能称项目直连 CoinGlass/Dune；无真实上游 URL 时不凭路径补出一个官方 API。
- L3：原站公开页面 HTML/RSC 解析（TradFi 套利）。来源可追踪，但解析对页面结构变化更敏感。
- L4：未接入、方法待定或受限项。source.url 只可标候选/依赖来源，不能代表采集成功。
- D：本项目派生。登记所有输入 datasetId、公式、样本集合、日期规则、空值规则与公式版本，不伪装成第三方直接给出的值。
- 可靠性使用证据与缺口，不自创 90 分/高可信等评分；“同一响应字段一致”与“独立来源交叉核验”分开。
- 数据所属时间 (`asOf`/每行 date)、源缓存更新时间 (`sourceUpdatedAt`)、查询执行时间 (`sourceExecutionEndedAt`)、实际检查时间 (`checkedAt`)、最后成功读取时间 (`lastSuccessfulFetchedAt`)、站点发布时间应分开。源没有的时间保留 null。
- 当前 `tradfi_labels.coverage.observedAt` 来自采集时间，不是源提供时刻；需改为 obtainedAt 或 snapshotCollectedAt。官方快照的 observed_at 同样实质为本地采样时刻，应使用 asOfBasis 说明。
- pending 项当前仍带 fetchedAt（有的来自父资产源，有的是占位生成时间），registry 的 lastSuccessfulFetchedAt 应为 null；另存 checkedAt/placeholderCreatedAt，避免“今天更新过评分/份额”的错觉。
- 原数据全部未作公开再发布许可保证。19 个非空数据集有 productionEligible=false，16 个 ready 的 coverage.licenseStatus 也均为 unverified；这些是质量/许可元数据，不宜与有行就自动可用混为一谈。具体限制仅引用现有审计文件，本轮没有重新核验供应商条款。

## 当前采集计划与建议

现有 `.github/workflows/update-data.yml` 的两个计划点是 UTC 01:17、05:47，即每天北京时间 **09:17 主检查、13:47 补偿检查**。任务由 GitHub Actions 排程，实际开始可延迟；每个源的完成时间也不同。`scripts/collect.py` 并行调用两个采集器，`scripts/publish.py` 发布。此处确认的是配置，不是今天已执行的事实。

|计划代码|现状|说明|
|---|---|---|
|S2|每天 09:17 / 13:47 北京时间检查现有已接来源|没有确认上游固定发布 SLA；两次检查不保证上游每天出新数据，也不等于实时。采集日志需保存开始、完成、成功、失败和源水位。|
|M2|同 S2 检查月表|数据频率仍是月；按最新完整发布月份判断，不以自然日差误报月表延迟。|
|C2|同 S2 收集当前快照|有时效标签，不能标实时；若没有逐行源时钟，只能说“采集时取得”。|
|OFF|无自动数据请求|评分、Z-score、其他资产、27 板块、AI 及受限源；保留栏目，等待方法/接入/用户决策。占位生成时间不是数据更新。|
|DERIVED|输入更新后重新计算|无需新外部来源；继承最旧输入水位、质量与覆盖限制，记录公式版本。|

## 49 个基础数据集逐项登记

### 01. `cex_spot_daily` — 交易场所现货日成交额

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/json/cex-asset-vol/cex_exchange_daily_spot_volume_usd.json。
- **结果 / 计划**：基线状态 `ready`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；USD；dimensions=["date"]；measures=["Binance","Bitfinex","Bitget","Bybit","Coinbase","Crypto.com","Deribit","Gate","HTX","Hyperliquid","Kraken","KuCoin","MEXC","OKX","Uniswap","Upbit","ALL"]。
- **数据时间**：asOf=2026-09-13；源缓存更新时间=2026-09-13T22:39:05Z；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:12:43+08:00。
- **覆盖**：保存日期=2026-03-18～2026-09-13，180 个日期；原响应=1403 行，原始日期=2022-11-11～2026-09-13；截断=True。
- **已有可靠性证据**：原站 USD 字段与日表结构明确；16 个单独场所，另有 ALL。
- **不足 / 不能确认**：CEX/DEX 混合样本，不是全球 CEX；ALL 不得加到单所合计；底层交易所数据未交叉复算。
- **原因及处理**：先使用原样本标注；派生份额按实际列、同日有效数据计算。
- **沿用的原始说明**：原站收录交易场所样本，含去中心化场所；份额分母需明确收录集合，不能称全球份额。ALL 不得重复相加。
- **返回系列**：Binance、Bitfinex、Bitget、Bybit、Coinbase、Crypto.com、Deribit、Gate、HTX、Hyperliquid、Kraken、KuCoin、MEXC、OKX、Uniswap、Upbit、ALL

### 02. `cex_futures_daily` — 交易场所合约日成交额

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/json/cex-asset-vol/cex_exchange_daily_futures_volume_usd.json。
- **结果 / 计划**：基线状态 `ready`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；USD；dimensions=["date"]；measures=["Binance","Bitfinex","Bitget","Bybit","Coinbase","Crypto.com","Deribit","Gate","HTX","Hyperliquid","Kraken","KuCoin","MEXC","OKX","ALL"]。
- **数据时间**：asOf=2026-09-13；源缓存更新时间=2026-09-13T22:39:05Z；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:12:43+08:00。
- **覆盖**：保存日期=2026-03-18～2026-09-13，180 个日期；原响应=1403 行，原始日期=2022-11-11～2026-09-13；截断=True。
- **已有可靠性证据**：原站 USD 字段与日表结构明确；14 个单独场所，另有 ALL。
- **不足 / 不能确认**：包含 Hyperliquid；与现货列集合不同；聚合口径与场所源数据未独立复算。
- **原因及处理**：份额标成样本份额；合约/现货比仅同场所同日期。
- **沿用的原始说明**：原站收录交易场所样本，含去中心化场所；份额分母需明确收录集合，不能称全球份额。ALL 不得重复相加。
- **返回系列**：Binance、Bitfinex、Bitget、Bybit、Coinbase、Crypto.com、Deribit、Gate、HTX、Hyperliquid、Kraken、KuCoin、MEXC、OKX、ALL

### 03. `cex_spot_monthly` — 交易场所现货月成交额

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/json/cex-asset-vol/cex_exchange_monthly_spot_volume_usd.json。
- **结果 / 计划**：基线状态 `ready`，45 行；M2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：month；USD；dimensions=["date"]；measures=["Binance","Bitfinex","Bitget","Bybit","Coinbase","Crypto.com","Deribit","Gate","HTX","Hyperliquid","Kraken","KuCoin","MEXC","OKX","Uniswap","Upbit","ALL"]。
- **数据时间**：asOf=2026-08-31；源缓存更新时间=2026-09-10T22:00:27Z；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:12:43+08:00。
- **覆盖**：保存日期=2022-11-01～2026-08-01，45 个日期；原响应=45 行，原始日期=2022-11-01～2026-08-01；截断=False。
- **已有可靠性证据**：45 个月度行；row.date 为月初，asOf 转为最后一个返回月份的月末。
- **不足 / 不能确认**：月频不需要每天新增数值；completed month-end 是采集器约定，不能仅凭该字段证明该月已经结算完整。
- **原因及处理**：每日检查，按月发布；明确统计月份、源更新时间。
- **沿用的原始说明**：原站收录交易场所样本，含去中心化场所；份额分母需明确收录集合，不能称全球份额。ALL 不得重复相加。
- **返回系列**：Binance、Bitfinex、Bitget、Bybit、Coinbase、Crypto.com、Deribit、Gate、HTX、Hyperliquid、Kraken、KuCoin、MEXC、OKX、Uniswap、Upbit、ALL

### 04. `cex_futures_monthly` — 交易场所合约月成交额

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/json/cex-asset-vol/cex_exchange_monthly_futures_volume_usd.json。
- **结果 / 计划**：基线状态 `ready`，45 行；M2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：month；USD；dimensions=["date"]；measures=["Binance","Bitfinex","Bitget","Bybit","Coinbase","Crypto.com","Deribit","Gate","HTX","Hyperliquid","Kraken","KuCoin","MEXC","OKX","ALL"]。
- **数据时间**：asOf=2026-08-31；源缓存更新时间=2026-09-13T22:39:06Z；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:12:43+08:00。
- **覆盖**：保存日期=2022-11-01～2026-08-01，45 个日期；原响应=45 行，原始日期=2022-11-01～2026-08-01；截断=False。
- **已有可靠性证据**：45 个月度行；row.date 为月初，asOf 为月份末日。
- **不足 / 不能确认**：与现货月表更新时间不同；不要跨月份相除；月完整性尚无显式源水位。
- **原因及处理**：每日检查，按同月同场所派生比率。
- **沿用的原始说明**：原站收录交易场所样本，含去中心化场所；份额分母需明确收录集合，不能称全球份额。ALL 不得重复相加。
- **返回系列**：Binance、Bitfinex、Bitget、Bybit、Coinbase、Crypto.com、Deribit、Gate、HTX、Hyperliquid、Kraken、KuCoin、MEXC、OKX、ALL

### 05. `cex_reserves_daily` — 交易场所公开资产历史

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/json/cex-asset-vol/cex_exchange_daily_assets_usd.json。
- **结果 / 计划**：基线状态 `ready`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；USD；dimensions=["date"]；measures=["Binance","Bitfinex","Bitget","Bybit","Crypto.com","Deribit","Gate","HTX","Hyperliquid","KuCoin","MEXC","OKX","Uniswap"]。
- **数据时间**：asOf=2026-09-13；源缓存更新时间=2026-09-13T22:39:05Z；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:12:50+08:00。
- **覆盖**：保存日期=2026-03-18～2026-09-13，180 个日期；原响应=2872 行，原始日期=2018-11-03～2026-09-13；截断=True。
- **已有可靠性证据**：13 个场所 USD 资产列，包含 Hyperliquid、Uniswap。
- **不足 / 不能确认**：资产规模不是负债覆盖、净资产或偿付能力；地址集合和估值方法未独立核实。
- **原因及处理**：明确资产口径，评分独立保留待决策。
- **沿用的原始说明**：原站收录样本包含 Hyperliquid/Uniswap；应按场所类型筛选。ALL 是源合计，不得与单所列重复加总。资产规模不代表负债覆盖或偿付能力。
- **返回系列**：Binance、Bitfinex、Bitget、Bybit、Crypto.com、Deribit、Gate、HTX、Hyperliquid、KuCoin、MEXC、OKX、Uniswap

### 06. `futures_oi_btc` — BTC 全市场聚合持仓

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/api/coinglass/futures/aggregated-open-interest-history?symbol=BTC&interval=1d&limit=180。
- **结果 / 计划**：基线状态 `ready`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；USD；dimensions=["date","entity"]；measures=["value","open","high","low","close"]。
- **数据时间**：asOf=2026-09-14；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:14:20+08:00。
- **覆盖**：保存日期=2026-03-19～2026-09-14，180 个日期；原响应=235 行，原始日期=2026-01-23～2026-09-14；截断=True。 保存实体 1 个。
- **已有可靠性证据**：源 latestOiUsd 与最后 close 一致，通过采集器数值核验，采用 USD。
- **不足 / 不能确认**：仅 BTC；“全市场”指该接口聚合样本，完整交易所清单未在标准化表保存；最新日完整性待核。
- **原因及处理**：保留 OHLC；补 aggregationUniverse、periodComplete 后再做高管结论。
- **沿用的原始说明**：聚合持仓USD由源latestOiUsd字段与最后close一致确认；不是抵押保证金。

### 07. `futures_oi_eth` — ETH 全市场聚合持仓

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/api/coinglass/futures/aggregated-open-interest-history?symbol=ETH&interval=1d&limit=180。
- **结果 / 计划**：基线状态 `ready`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；USD；dimensions=["date","entity"]；measures=["value","open","high","low","close"]。
- **数据时间**：asOf=2026-09-14；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:14:20+08:00。
- **覆盖**：保存日期=2026-03-19～2026-09-14，180 个日期；原响应=235 行，原始日期=2026-01-23～2026-09-14；截断=True。 保存实体 1 个。
- **已有可靠性证据**：源 latestOiUsd 与最后 close 一致，通过采集器数值核验，采用 USD。
- **不足 / 不能确认**：仅 ETH；同源校验不等于独立第二来源核验；最新日完整性待核。
- **原因及处理**：与 BTC 相同；保存最新日状态。
- **沿用的原始说明**：聚合持仓USD由源latestOiUsd字段与最后close一致确认；不是抵押保证金。

### 08. `spot_volume_btc` — BTC 聚合现货成交额

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/api/coinglass/spot/aggregated-volume-history?symbol=BTC&interval=1d&limit=180。
- **结果 / 计划**：基线状态 `ready`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；USD；dimensions=["date","entity"]；measures=["value","close","volume_usd"]。
- **数据时间**：asOf=2026-09-14；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:13:01+08:00。
- **覆盖**：保存日期=2026-03-19～2026-09-14，180 个日期；原响应=180 行，原始日期=2026-03-19～2026-09-14；截断=False。 保存实体 1 个。
- **已有可靠性证据**：源 volume_usd 明示 USD；保留 close 参考收盘价。
- **不足 / 不能确认**：仅 BTC，交易所覆盖集合不明；close 不是可执行报价；最新日完整性待核。
- **原因及处理**：其他资产另登记占位，不以 BTC 样本代表全资产。
- **沿用的原始说明**：源volume_usd为美元成交额；close为聚合收盘参考价，不能当可执行成交报价。

### 09. `futures_volume_btc` — BTC 聚合合约成交额

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/api/coinglass/futures/aggregated-volume-history?symbol=BTC&interval=1d&limit=180。
- **结果 / 计划**：基线状态 `ready`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；USD；dimensions=["date","entity"]；measures=["value","close","volume_usd"]。
- **数据时间**：asOf=2026-09-14；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:14:24+08:00。
- **覆盖**：保存日期=2026-03-19～2026-09-14，180 个日期；原响应=234 行，原始日期=2026-01-24～2026-09-14；截断=True。 保存实体 1 个。
- **已有可靠性证据**：源 volume_usd 明示 USD；历史成交额与参考收盘价分别保留。
- **不足 / 不能确认**：仅 BTC；现货与合约采集时间不一致，需同数据日比较；最新日完整性待核。
- **原因及处理**：比较时仅取共同完整日期。
- **沿用的原始说明**：源volume_usd为美元成交额；close为聚合收盘参考价，不能当可执行成交报价。

### 10. `futures_oi_exchange_btc` — Binance BTCUSDT 持仓历史

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/json/futures-open-interest-history/Binance_BTCUSDT_1d.json。
- **结果 / 计划**：基线状态 `review`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；source-unit；dimensions=["date","entity"]；measures=["value","open","high","low","close"]。
- **数据时间**：asOf=2026-09-13；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:15:49+08:00。
- **覆盖**：保存日期=2026-03-18～2026-09-13，180 个日期；原响应=2391 行，原始日期=2020-02-27～2026-09-13；截断=True。 保存实体 1 个。
- **已有可靠性证据**：已取得 Binance BTCUSDT 日 OHLC 原值。
- **不足 / 不能确认**：裸 JSON 无 unit；原页面标 USD 仍不能单独证明量纲。
- **原因及处理**：unit_unverified；保留 source-unit，待同交易所合约定义交叉核验。
- **沿用的原始说明**：原站页面标USD，裸JSON无unit字段；保留原始数值。需与交易所名义美元OI交叉核验后改为USD。

### 11. `futures_oi_stablecoin_btc` — BTC 稳定币本位合约持仓

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/json/futures-open-interest-aggregated-stablecoin-history/BTC_1d.json。
- **结果 / 计划**：基线状态 `review`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；source-unit；dimensions=["date","entity"]；measures=["value","open","high","low","close"]。
- **数据时间**：asOf=2026-09-13；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:14:18+08:00。
- **覆盖**：保存日期=2026-03-18～2026-09-13，180 个日期；原响应=1061 行，原始日期=2023-10-19～2026-09-13；截断=True。 保存实体 1 个。
- **已有可靠性证据**：已取得 BTC 稳定币保证金类别的日 OI 原值。
- **不足 / 不能确认**：这是按保证金类型拆分的 OI，不是抵押保证金余额；与币本位量纲未证实相同。
- **原因及处理**：unit_unverified；不得相加或擅自美元换算。
- **沿用的原始说明**：源端点是按保证金币种拆分的合约持仓，并非实际抵押保证金。两文件量纲可能不同，未确认前不得相加、自动换汇或标USD。

### 12. `futures_oi_coin_btc` — BTC 币本位合约持仓

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/json/futures-open-interest-aggregated-coin-margin-history/BTC_1d.json。
- **结果 / 计划**：基线状态 `review`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；source-unit；dimensions=["date","entity"]；measures=["value","open","high","low","close"]。
- **数据时间**：asOf=2026-09-13；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:14:20+08:00。
- **覆盖**：保存日期=2026-03-18～2026-09-13，180 个日期；原响应=1061 行，原始日期=2023-10-19～2026-09-13；截断=True。 保存实体 1 个。
- **已有可靠性证据**：已取得 BTC 币本位类别的日 OI 原值。
- **不足 / 不能确认**：裸文件无明示单位；与稳定币保证金 OI 不可在未核量纲时相加。
- **原因及处理**：unit_unverified；维持原值和待核标记。
- **沿用的原始说明**：源端点是按保证金币种拆分的合约持仓，并非实际抵押保证金。两文件量纲可能不同，未确认前不得相加、自动换汇或标USD。

### 13. `funding_oi_btc` — BTC 持仓加权资金费率

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/json/futures-funding-rate-oi-weight-history/BTC_1d.json。
- **结果 / 计划**：基线状态 `review`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；source-rate；dimensions=["date","entity"]；measures=["value","open","high","low","close"]。
- **数据时间**：asOf=2026-09-13；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:14:22+08:00。
- **覆盖**：保存日期=2026-03-18～2026-09-13，180 个日期；原响应=2358 行，原始日期=2020-03-31～2026-09-13；截断=True。 保存实体 1 个。
- **已有可靠性证据**：已取得 BTC OI 加权资金费率日 OHLC。
- **不足 / 不能确认**：fraction/百分比与加权方法未独立证明；1d 采样桶不等于 1d 或 8h 结算。
- **原因及处理**：unit_unverified；不乘 100、不年化、不直接生成 Z-score。
- **沿用的原始说明**：保留源费率原值。原站UI乘100，而上游示例未明示fraction/百分比；单位未独立核验前不乘100、不年化。1d是采样桶而非结算间隔。

### 14. `funding_vol_btc` — BTC 成交加权资金费率

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/json/futures-funding-rate-vol-weight-history/BTC_1d.json。
- **结果 / 计划**：基线状态 `review`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；source-rate；dimensions=["date","entity"]；measures=["value","open","high","low","close"]。
- **数据时间**：asOf=2026-09-13；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:14:23+08:00。
- **覆盖**：保存日期=2026-03-18～2026-09-13，180 个日期；原响应=1240 行，原始日期=2023-04-23～2026-09-13；截断=True。 保存实体 1 个。
- **已有可靠性证据**：已取得 BTC 成交量加权资金费率日 OHLC。
- **不足 / 不能确认**：费率单位、权重覆盖与结算周期尚未独立确认。
- **原因及处理**：unit_unverified；与 OI 加权分别保留。
- **沿用的原始说明**：保留源费率原值。原站UI乘100，而上游示例未明示fraction/百分比；单位未独立核验前不乘100、不年化。1d是采样桶而非结算间隔。

### 15. `funding_btc` — Binance BTCUSDT 资金费率

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/api/coinglass/futures/realtime-funding-rate/multi-exchange?symbol=BTC&interval=1d&limit=180&exchange=Binance&pair=BTCUSDT。
- **结果 / 计划**：基线状态 `review`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；source-rate；dimensions=["date","entity","instrument"]；measures=["value","open","high","low"]。
- **数据时间**：asOf=2026-09-14；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:15:48+08:00。
- **覆盖**：保存日期=2026-03-19～2026-09-14，180 个日期；原响应=180 行，原始日期=2026-03-19～2026-09-14；截断=False。 保存实体 1 个。
- **已有可靠性证据**：本快照只有 Binance BTCUSDT 的 180 日数据。
- **不足 / 不能确认**：API 路径称 multi-exchange 不等于当前实际多所；源费率 fraction/百分比待核。
- **原因及处理**：先明确单所样本；其他交易所/标的需逐项连接核验。
- **沿用的原始说明**：源费率原值；尚未证明fraction/百分比单位，禁止盲目乘100或套用8h。

### 16. `funding_arbitrage` — 跨所资金费率比较

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/api/coinglass/futures/funding-rate-arbitrage?usd=10000。
- **结果 / 计划**：基线状态 `review`，200 行；C2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：snapshot；mixed；dimensions=["entity","buyExchange","sellExchange"]；measures=["sourceApr","sourceFundingSpread","sourceFee","sourcePriceSpread","buyFundingRate","sellFundingRate","buyIntervalHours","sellIntervalHours","buyOiUsd","sellOiUsd"]。
- **数据时间**：asOf=null；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:13:03+08:00。
- **覆盖**：保存日期=无逐日日期～无逐日日期，0 个日期；原响应=497 行，原始日期=未记录～未记录；截断=True。 保存实体 200 个。
- **已有可靠性证据**：保留 buy/sell 交易所、原 APR/费率/费用/价差、实际结算间隔和下一次结算时刻。
- **不足 / 不能确认**：497 行源结果只保存前 200 行；无观察时间；nextFundingTime 不是 sourceUpdatedAt；源 APR 不能当收益承诺。
- **原因及处理**：snapshot_time_unknown、coverage_truncated、unit_unverified；只能作为带时间限制的观察表。
- **沿用的原始说明**：源年度化估值和费率原值，非保证收益；未提供观察时间。nextFundingTime不是数据更新时间。保留实际间隔；缺失不补零。

### 17. `tradfi_labels` — 热门板块分类目录

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/api/coinglass/futures/tradfi-volume-overview?source=tag&labels_only=1。
- **结果 / 计划**：基线状态 `ready`，28 行；C2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：snapshot；pairs；dimensions=["entity"]；measures=["pairCount"]。
- **数据时间**：asOf=null；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:12:46+08:00。
- **覆盖**：保存日期=无逐日日期～无逐日日期，0 个日期；原响应=28 行，原始日期=未记录～未记录；截断=False。 保存实体 28 个。
- **已有可靠性证据**：原站返回 28 类及 pairCount；当前目录完整保存。
- **不足 / 不能确认**：pairCount 是交易对数，不是独立资产数；标签可重叠；coverage.observedAt 由采集时间填入，不是源明确观察时刻。
- **原因及处理**：将该字段改记 retrievedAt/obtainedAt；目录准备好不代表 28 类历史准备好。
- **沿用的原始说明**：pairCount是来源交易对覆盖数，不是公司/独立股票代币数。完整28类保留。

### 18. `tradfi_stocks` — Stocks 永续合约日成交

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/api/coinglass/futures/tradfi-volume-overview?source=tag&label=Stocks&interval=1d&limit=180。
- **结果 / 计划**：基线状态 `ready`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；USD；dimensions=["date"]；measures=["Stocks"]。
- **数据时间**：asOf=2026-09-13；源缓存更新时间=2026-09-14T16:10:54.529000Z；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:12:48+08:00。
- **覆盖**：保存日期=2026-03-18～2026-09-13，180 个日期；原响应=273 行，原始日期=2025-12-15～2026-09-13；截断=True。
- **已有可靠性证据**：Stocks 成交序列；源回报成交 pair_count=2159、success_count=2159、missing_count=0。
- **不足 / 不能确认**：这是股票主题永续合约，不等于股票代币现货；分类和合约映射未逐对验证。
- **原因及处理**：继续用原产品定义；不无授权改为股票代币现货。
- **沿用的原始说明**：CEX/Hyperliquid股票主题永续；不等于链上股票代币现货。只含接口返回的资产/场所系列，分类可重叠。
- **返回系列**：Stocks

### 19. `tradfi_stock_assets` — Stocks 标的日成交

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/api/coinglass/futures/tradfi-volume-overview?source=tag&label=Stocks&interval=1d&limit=180。
- **结果 / 计划**：基线状态 `ready`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；USD；dimensions=["date"]；measures=["SNDK","SKHYNIX","SOXL","MU","XYZ100","SKHX","AAPL","NVDA","KORU","MSTR","GOOGL","EWY","CRCL","INTC","SKHY","Other"]。
- **数据时间**：asOf=2026-09-13；源缓存更新时间=2026-09-14T16:10:54.529000Z；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:12:48+08:00。
- **覆盖**：保存日期=2026-03-18～2026-09-13，180 个日期；原响应=273 行，原始日期=2025-12-15～2026-09-13；截断=True。
- **已有可靠性证据**：16 条标的/聚合系列，包括 Other；同一 Stocks 源响应。
- **不足 / 不能确认**：SKHY/SKHYNIX/SKHX 等别名是否同标的需映射；Other 不能当独立资产，不能把 16 系列称 2159 标的覆盖。
- **原因及处理**：标记系列层级；保留 Other，身份映射完成前不合并。
- **沿用的原始说明**：CEX/Hyperliquid股票主题永续；不等于链上股票代币现货。只含接口返回的资产/场所系列，分类可重叠。
- **返回系列**：SNDK、SKHYNIX、SOXL、MU、XYZ100、SKHX、AAPL、NVDA、KORU、MSTR、GOOGL、EWY、CRCL、INTC、SKHY、Other

### 20. `tradfi_stock_exchanges` — Stocks 交易所日成交

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/api/coinglass/futures/tradfi-volume-overview?source=tag&label=Stocks&interval=1d&limit=180。
- **结果 / 计划**：基线状态 `ready`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；USD；dimensions=["date"]；measures=["Binance","Hyperliquid","Gate","Bybit","Bitget","OKX","MEXC","Coinbase","HTX","Kraken","Crypto.com"]。
- **数据时间**：asOf=2026-09-13；源缓存更新时间=2026-09-14T16:10:54.529000Z；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:12:48+08:00。
- **覆盖**：保存日期=2026-03-18～2026-09-13，180 个日期；原响应=273 行，原始日期=2025-12-15～2026-09-13；截断=True。
- **已有可靠性证据**：11 场所成交历史；与 Stocks 总成交共用源响应。
- **不足 / 不能确认**：不同平台产品范围和覆盖可能不同；源 SQL/全交易对明细没有纳入标准化文件。
- **原因及处理**：展示场所收录范围和同日覆盖，不当全市场份额。
- **沿用的原始说明**：CEX/Hyperliquid股票主题永续；不等于链上股票代币现货。只含接口返回的资产/场所系列，分类可重叠。
- **返回系列**：Binance、Hyperliquid、Gate、Bybit、Bitget、OKX、MEXC、Coinbase、HTX、Kraken、Crypto.com

### 21. `tradfi_stock_oi_assets` — Stocks 标的持仓历史

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/api/coinglass/futures/tradfi-volume-overview?source=tag&label=Stocks&interval=1d&limit=180。
- **结果 / 计划**：基线状态 `ready`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；USD；dimensions=["date"]；measures=["SNDK","SPCX","SKHY","SKHYNIX","MU","SKHX","NVDA","XYZ100","CRCL","GOOGL","SOXL","DRAM","INTC","MSTR","AAPL","Unmapped","Other"]。
- **数据时间**：asOf=2026-09-13；源缓存更新时间=2026-09-14T16:10:54.529000Z；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:12:48+08:00。
- **覆盖**：保存日期=2026-03-18～2026-09-13，180 个日期；原响应=464 行，原始日期=2024-01-20～2026-09-13；截断=True。
- **已有可靠性证据**：17 条 OI 系列，含 Other/Unmapped；源 OI pair_count=2159、success_count=1803、missing_count=0。
- **不足 / 不能确认**：2159−1803=356，但 missing_count=0，三个字段没有闭合；不能以 missing=0 宣称完整。
- **原因及处理**：要求解释 356 个未成功/不适用交易对；当前仅称返回样本，保留 Unmapped。
- **沿用的原始说明**：CEX/Hyperliquid股票主题永续；不等于链上股票代币现货。只含接口返回的资产/场所系列，分类可重叠。
- **返回系列**：SNDK、SPCX、SKHY、SKHYNIX、MU、SKHX、NVDA、XYZ100、CRCL、GOOGL、SOXL、DRAM、INTC、MSTR、AAPL、Unmapped、Other

### 22. `tradfi_stock_oi_exchanges` — Stocks 交易所持仓历史

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/api/coinglass/futures/tradfi-volume-overview?source=tag&label=Stocks&interval=1d&limit=180。
- **结果 / 计划**：基线状态 `ready`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；USD；dimensions=["date"]；measures=["Binance","Hyperliquid","Gate","Bitget","OKX","Bybit","Coinbase","Kraken","HTX","Crypto.com"]。
- **数据时间**：asOf=2026-09-13；源缓存更新时间=2026-09-14T16:10:54.529000Z；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:12:48+08:00。
- **覆盖**：保存日期=2026-03-18～2026-09-13，180 个日期；原响应=181 行，原始日期=2026-03-17～2026-09-13；截断=True。
- **已有可靠性证据**：10 场所 OI 历史；共用上述 Stocks OI 覆盖字段。
- **不足 / 不能确认**：OI 只 10 场所，成交量为 11 场所；覆盖字段不闭合，不能拿两侧全部集合直接算比率。
- **原因及处理**：仅同场所同日期比较，登记 OI 覆盖不明。
- **沿用的原始说明**：CEX/Hyperliquid股票主题永续；不等于链上股票代币现货。只含接口返回的资产/场所系列，分类可重叠。
- **返回系列**：Binance、Hyperliquid、Gate、Bitget、OKX、Bybit、Coinbase、Kraken、HTX、Crypto.com

### 23. `tradfi_stock_funding` — Stocks 标的费率

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/api/coinglass/futures/tradfi-volume-overview?source=tag&label=Stocks&interval=1d&limit=180。
- **结果 / 计划**：基线状态 `review`，20 行；C2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：snapshot；source-rate；dimensions=["date","entity","exchange"]；measures=["sourceRate"]。
- **数据时间**：asOf=2026-09-13；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:12:48+08:00。
- **覆盖**：保存日期=2026-09-03～2026-09-13，6 个日期；原响应=20 行，原始日期=2026-09-03～2026-09-13；截断=False。 保存实体 20 个。
- **已有可靠性证据**：20 条费率记录，包含资产、场所和各自日期。
- **不足 / 不能确认**：记录日期从 9/3 到 9/13，asOf 仅最大值，不是所有行都在最新日；费率单位和结算间隔待核。
- **原因及处理**：row_time_mixed、unit_unverified；逐行显示日期，不以最大日期代表全表新鲜。
- **沿用的原始说明**：板块源最新费率，结算周期与百分比单位待核验；不跨所相加。

### 24. `tradfi_exchange_comparison` — Stocks 交易所横向比较

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/api/tradfi/deep?label=Stocks。
- **结果 / 计划**：基线状态 `review`，12 行；C2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：snapshot；mixed；dimensions=["entity"]；measures=["volumeUsd","oiUsd","fundingRate","premiumPct","focusHits"]。
- **数据时间**：asOf=null；源缓存更新时间=2026-09-14T15:02:09.996000Z；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:12:48+08:00。
- **覆盖**：保存日期=无逐日日期～无逐日日期，0 个日期；原响应=12 行，原始日期=未记录～未记录；截断=False。 保存实体 12 个。
- **已有可靠性证据**：12 交易所；volumeUsd 为板块范围；OI/费率/溢价只焦点 TSLA/NVDA/AAPL/MU/META；focusHits=0 时三字段归 null。
- **不足 / 不能确认**：不同指标覆盖不同；没有共同 observedAt；updatedAt 是源缓存更新时间；指数溢价不是美股现货溢价。
- **原因及处理**：列标题明示焦点样本；保留 null，不能把局部缺项自动补 0。
- **沿用的原始说明**：成交覆盖整个返回板块；OI/费率/溢价仅焦点标的。focusHits=0的伪零归为null。指数溢价不是美股现货溢价；不同字段时点可能不同。
- **焦点范围**：TSLA、NVDA、AAPL、MU、META

### 25. `stablecoin_marketcap` — 稳定币市值历史

- **来源 / 层级**：L2；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/api/coinglass/index/stableCoin-marketCap-history。
- **结果 / 计划**：基线状态 `ready`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day；USD；dimensions=["date"]；measures=["all_stablecoins","all_usdt","ethereum_stablecoins","all_usdc","all_tusd","tron_stablecoins","all_usds/dai","polygon_stablecoins","bsc_stablecoins","avalanche_stablecoins","arbitrum_stablecoins","solana_stablecoins","op_mainnet_stablecoins","all_usdd","aptos_stablecoins","all_fdusd","all_pyusd","base_stablecoins","mantle_stablecoins","all_usde","ton_stablecoins","all_rlusd","hyperliquid_l1_stablecoins","x_layer_stablecoins","all_usd1","all_usdg","plasma_stablecoins"]。
- **数据时间**：asOf=2026-09-13；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:12:55+08:00。
- **覆盖**：保存日期=2026-03-18～2026-09-13，180 个日期；原响应=3211 行，原始日期=2017-11-29～2026-09-13；截断=True。
- **已有可靠性证据**：总市值、11 个币种/组合、15 条链的日 USD 列；USDS/DAI 合并。
- **不足 / 不能确认**：不是币种×链交叉矩阵；细分集合不保证闭合；按链表格必须同步投影列，不能只改图表 measures。
- **原因及处理**：按币种和按链分别呈现已有列；禁止从边际表推断交叉矩阵。
- **沿用的原始说明**：总市值、11个币种/币种组合、15条链；USDS/DAI合并。并非币种×链交叉矩阵；细分可能不完整，不强行凑总数。

### 26. `tradfi_arbitrage` — TradFi 跨市场参考报价

- **来源 / 层级**：L3；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/dashboard/tradfi-spot-arb。
- **结果 / 计划**：基线状态 `review`，77 行；C2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：snapshot；mixed；dimensions=["entity","sector"]；measures=["referencePrice","sourceBestNetPremiumPct","OKXPrice","OKXPremiumPct","OKXSourceFundingRate","GatePrice","GatePremiumPct","GateSourceFundingRate","BitgetPrice","BitgetPremiumPct","BitgetSourceFundingRate","Crypto.comPrice","Crypto.comPremiumPct","CoinbasePrice","CoinbasePremiumPct","CoinbaseSourceFundingRate","BybitPrice","BybitPremiumPct","BybitSourceFundingRate","BinancePrice","BinancePremiumPct","BinanceSourceFundingRate","HyperliquidPrice","HyperliquidPremiumPct","HTXPrice","HTXPremiumPct","HTXSourceFundingRate","HyperliquidSourceFundingRate","MEXCPrice","MEXCPremiumPct","KrakenPrice","KrakenPremiumPct","KrakenSourceFundingRate","MEXCSourceFundingRate"]。
- **数据时间**：asOf=2026-09-14T15:30:43.532000Z；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:14:23+08:00。
- **覆盖**：保存日期=无逐日日期～无逐日日期，0 个日期；原响应=77 行，原始日期=未记录～未记录；截断=False。 保存实体 77 个。
- **已有可靠性证据**：公开 HTML 序列化 spot.live，77 资产、Yahoo 参考价与场所腿；每腿 AsOf 保存；源声明 scheduleSeconds=3600。
- **不足 / 不能确认**：HTML/RSC 结构变化会影响解析；同表报价时间不一致，参考价可能休市/stale；源费率、溢价、映射未独立核验。
- **原因及处理**：本项目每日两次，不称实时/小时级；逐腿时点及 stale 展示，禁止把净边当可执行收益。
- **沿用的原始说明**：Yahoo参考价对永续快照；源代码映射与费率单位未独立核验。不把净边当可执行收益；各报价有自己的时点。未复制源研究文字。

### 27. `cex_reserve_score` — 储备可信度

- **来源 / 层级**：L4；吴说数据中心公开数据（原站聚合）；https://data.wublock123.com/json/cex-asset-vol/cex_exchange_daily_assets_usd.json。
- **结果 / 计划**：基线状态 `pending`，0 行；OFF。当前无数据成功记录；占位字段 fetchedAt=2026-09-14T16:12:50.109744Z，不得用作该项最后成功采集时间。
- **粒度 / 单位**：research；score；dimensions=[]；measures=[]。
- **数据时间**：asOf=null；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=null。
- **覆盖**：保存日期=无逐日日期～无逐日日期，0 个日期；原响应=0 行，原始日期=未记录～未记录；截断=False。
- **已有可靠性证据**：当前 0 行；未复制作者评分，评分面板保留。
- **不足 / 不能确认**：无自有评分方法、证据权重或审查责任；source.url 借自资产源不是评分来源，fetchedAt 也不是评分采集成功。
- **原因及处理**：methodology_unapproved；由用户决定保留占位或批准另拟评分口径，不能自行删除。
- **沿用的原始说明**：原作者手工研究评分未复制；栏目保留，待确认是否建立自有研究口径。

### 28. `rh_daily_transactions` — Robinhood Chain 日交易

- **来源 / 层级**：L2；原站公开缓存 / Dune；https://data.wublock123.com/api/robinhood-chain/daily_transactions。 记录上游：https://dune.com/queries/7915115；queryId=7915115；本项目不是直连该 Dune 查询。
- **结果 / 计划**：基线状态 `stale`，75 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day × metric；count；dimensions=["date","entity"]；measures=["value","transactions"]。
- **数据时间**：asOf=2026-09-12；源缓存更新时间=2026-09-13T22:33:50Z；源查询执行完成=2026-09-13T18:02:47.486999Z；最后成功取得（北京时间）=2026-09-15T00:18:35+08:00。
- **覆盖**：保存日期=2026-06-30～2026-09-12，75 个日期；原响应=75 行，原始日期=2026-06-30～2026-09-12；截断=False。 保存实体 1 个。
- **已有可靠性证据**：公开缓存含交易笔数日历史；Dune queryId 和执行完成时间可追溯。
- **不足 / 不能确认**：原站标题对应的链/网络身份尚未对照 SQL；本地源最后日落后。
- **原因及处理**：source_delayed、identity_unverified；保留日期并继续检查已接缓存。
- **沿用的原始说明**：原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。 数据日落后当前UTC日期 2 天；缓存更新/本次采集时间不代表数据更新。 链与网络身份依原站标题，须对照Dune SQL验收；不把专题归类当已验证链归属。

### 29. `rh_active_wallets` — Robinhood Chain 活跃地址

- **来源 / 层级**：L2；原站公开缓存 / Dune；https://data.wublock123.com/api/robinhood-chain/active_wallets。 记录上游：https://dune.com/queries/7916628；queryId=7916628；本项目不是直连该 Dune 查询。
- **结果 / 计划**：基线状态 `stale`，145 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day × wallet_type；addresses；dimensions=["date","entity","wallet_type"]；measures=["value","wallets"]。
- **数据时间**：asOf=2026-09-10；源缓存更新时间=2026-09-11T21:01:49Z；源查询执行完成=2026-09-11T17:24:58.300709Z；最后成功取得（北京时间）=2026-09-15T00:18:35+08:00。
- **覆盖**：保存日期=2026-06-30～2026-09-10，73 个日期；原响应=145 行，原始日期=2026-06-30～2026-09-10；截断=False。 保存实体 2 个。
- **已有可靠性证据**：有 new/returning 钱包日系列；Dune 查询出处与执行时间。
- **不足 / 不能确认**：地址不是人数；new/returning 分类和去重定义需 SQL；该源较同专题其他表更旧。
- **原因及处理**：不得跨天累加成用户数；逐表显示截止日。
- **沿用的原始说明**：原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。 数据日落后当前UTC日期 4 天；缓存更新/本次采集时间不代表数据更新。 链与网络身份依原站标题，须对照Dune SQL验收；不把专题归类当已验证链归属。

### 30. `rh_dex_volume` — Robinhood Chain DEX 成交量

- **来源 / 层级**：L2；原站公开缓存 / Dune；https://data.wublock123.com/api/robinhood-chain/dex_volume。 记录上游：https://dune.com/queries/7915153；queryId=7915153；本项目不是直连该 Dune 查询。
- **结果 / 计划**：基线状态 `stale`，996 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day × dex；USD；dimensions=["date","entity","dex"]；measures=["value","volume_usd"]。
- **数据时间**：asOf=2026-09-12；源缓存更新时间=2026-09-13T22:33:55Z；源查询执行完成=2026-09-13T19:03:13.322308Z；最后成功取得（北京时间）=2026-09-15T00:18:35+08:00。
- **覆盖**：保存日期=2026-07-25～2026-09-12，50 个日期；原响应=1299 行，原始日期=2026-06-30～2026-09-12；截断=True。 保存实体 20 个。
- **已有可靠性证据**：日×协议/版本，USD 成交额；含原站返回场所名。
- **不足 / 不能确认**：含路由/协议版本，去重待核；Robinhood 专题不能混作全市场 DEX 分母；1000 行截断缩短历史。
- **原因及处理**：identity_unverified、coverage_truncated；展示实际起止与收录协议。
- **沿用的原始说明**：原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。 数据日落后当前UTC日期 2 天；缓存更新/本次采集时间不代表数据更新。 仅保留最新180天且最多1000行，按完整日期截取；实际显示覆盖见coverage。 Robinhood专题所收录链内数据；含协议版本与1inch等名称，底层/路由量去重及网络身份待核，不作全市场DEX份额。 链与网络身份依原站标题，须对照Dune SQL验收；不把专题归类当已验证链归属。

### 31. `rh_launchpad_new_tokens` — Meme Launchpad 新发代币

- **来源 / 层级**：L2；原站公开缓存 / Dune；https://data.wublock123.com/api/robinhood-chain/launchpad_new_tokens。 记录上游：https://dune.com/queries/7916783；queryId=7916783；本项目不是直连该 Dune 查询。
- **结果 / 计划**：基线状态 `stale`，981 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day × launchpad；tokens；dimensions=["date","entity","launchpad"]；measures=["value","tokens_launched"]。
- **数据时间**：asOf=2026-09-12；源缓存更新时间=2026-09-13T22:33:58Z；源查询执行完成=2026-09-13T20:41:02.219339Z；最后成功取得（北京时间）=2026-09-15T00:18:38+08:00。
- **覆盖**：保存日期=2026-08-09～2026-09-12，35 个日期；原响应=2260 行，原始日期=2026-06-30～2026-09-12；截断=True。 保存实体 59 个。
- **已有可靠性证据**：日×launchpad 新发代币数。
- **不足 / 不能确认**：rawEntityCount 与保留实体数不同；实体多造成实际只留部分近期日期。
- **原因及处理**：展示当前留存范围和原始范围，不宣称完整 180 天/全部 launchpad。
- **沿用的原始说明**：原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。 数据日落后当前UTC日期 2 天；缓存更新/本次采集时间不代表数据更新。 仅保留最新180天且最多1000行，按完整日期截取；实际显示覆盖见coverage。 链与网络身份依原站标题，须对照Dune SQL验收；不把专题归类当已验证链归属。

### 32. `rh_launchpad_activity` — Meme Launchpad 活动

- **来源 / 层级**：L2；原站公开缓存 / Dune；https://data.wublock123.com/api/robinhood-chain/launchpad_activity。 记录上游：https://dune.com/queries/8024180；queryId=8024180；本项目不是直连该 Dune 查询。
- **结果 / 计划**：基线状态 `stale`，1000 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day × launchpad；USD；dimensions=["date","entity"]；measures=["value","entity","launchpad","trades","volume_usd","wallets"]。
- **数据时间**：asOf=2026-09-12；源缓存更新时间=2026-09-13T22:34:01Z；源查询执行完成=2026-09-13T17:27:53.157484Z；最后成功取得（北京时间）=2026-09-15T00:18:39+08:00。
- **覆盖**：保存日期=2026-08-27～2026-09-12，17 个日期；原响应=3974 行，原始日期=2026-06-30～2026-09-12；截断=True。 保存实体 80 个。
- **已有可靠性证据**：日×launchpad 成交额、交易/钱包等原值。
- **不足 / 不能确认**：1000 行只留约 17 天；存在单行 >10 亿美元候选异常，没有证据允许直接删除。
- **原因及处理**：coverage_truncated、outlier_candidate；先定位源查询口径，保留并标记异常。
- **沿用的原始说明**：原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。 数据日落后当前UTC日期 2 天；缓存更新/本次采集时间不代表数据更新。 仅保留最新180天且最多1000行，按完整日期截取；实际显示覆盖见coverage。 保留原始值；单行成交额>10亿美元的异常候选 6 行，没有照搬原站阈值删除数据。 链与网络身份依原站标题，须对照Dune SQL验收；不把专题归类当已验证链归属。

### 33. `rh_rwa_aum` — Robinhood Chain RWA 市值

- **来源 / 层级**：L2；原站公开缓存 / Dune；https://data.wublock123.com/api/robinhood-chain/rwa_aum。 记录上游：https://dune.com/queries/8073404；queryId=8073404；本项目不是直连该 Dune 查询。
- **结果 / 计划**：基线状态 `stale`，298 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day × asset_class；USD；dimensions=["date","entity","asset_class"]；measures=["value","aum_usd"]。
- **数据时间**：asOf=2026-09-12；源缓存更新时间=2026-09-13T22:34:04Z；源查询执行完成=2026-09-13T17:57:13.058591Z；最后成功取得（北京时间）=2026-09-15T00:18:38+08:00。
- **覆盖**：保存日期=2026-06-29～2026-09-12，76 个日期；原响应=298 行，原始日期=2026-06-29～2026-09-12；截断=False。 保存实体 4 个。
- **已有可靠性证据**：4 个原站资产类别，日×类别 USD 资产规模。
- **不足 / 不能确认**：RWA 合约、估值和链身份均需原 SQL 核验；市值不是资金净流入。
- **原因及处理**：记录资产分类和估值口径，不能替换为净流入。
- **沿用的原始说明**：原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。 数据日落后当前UTC日期 2 天；缓存更新/本次采集时间不代表数据更新。 链与网络身份依原站标题，须对照Dune SQL验收；不把专题归类当已验证链归属。

### 34. `rh_rwa_volume` — Robinhood Chain RWA 成交

- **来源 / 层级**：L2；原站公开缓存 / Dune；https://data.wublock123.com/api/robinhood-chain/rwa_volume。 记录上游：https://dune.com/queries/8071940；queryId=8071940；本项目不是直连该 Dune 查询。
- **结果 / 计划**：基线状态 `stale`，254 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day × series；USD；dimensions=["date","entity","series"]；measures=["value","volume_usd"]。
- **数据时间**：asOf=2026-09-11；源缓存更新时间=2026-09-12T22:32:38Z；源查询执行完成=2026-09-12T15:58:39.736266Z；最后成功取得（北京时间）=2026-09-15T00:18:40+08:00。
- **覆盖**：保存日期=2026-07-10～2026-09-11，64 个日期；原响应=254 行，原始日期=2026-07-10～2026-09-11；截断=False。 保存实体 4 个。
- **已有可靠性证据**：4 个原站 series，日 USD 成交额。
- **不足 / 不能确认**：series 标签对应网络/产品需 SQL；源日期比其他 RH 表更旧。
- **原因及处理**：分别展示系列和时间，不并为全市场成交额。
- **沿用的原始说明**：原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。 数据日落后当前UTC日期 3 天；缓存更新/本次采集时间不代表数据更新。 链与网络身份依原站标题，须对照Dune SQL验收；不把专题归类当已验证链归属。

### 35. `hl_hip3_overview` — HIP-3 概览

- **来源 / 层级**：L2；原站公开缓存 / Dune；https://data.wublock123.com/api/hyperliquid/hip3_overview。 记录上游：https://dune.com/queries/8077142；queryId=8077142；本项目不是直连该 Dune 查询。
- **结果 / 计划**：基线状态 `stale`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day × metric；USD (来源页面口径)；dimensions=["date","entity"]；measures=["value","cum_volume","daily_volume","open_interest"]。
- **数据时间**：asOf=2026-09-11；源缓存更新时间=2026-09-13T22:33:31Z；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:18:41+08:00。
- **覆盖**：保存日期=2026-03-16～2026-09-11，180 个日期；原响应=334 行，原始日期=2025-10-13～2026-09-11；截断=True。 保存实体 1 个。
- **已有可靠性证据**：Dune 缓存日成交、OI、累计指标。
- **不足 / 不能确认**：来源页面 USD 口径，查询 SQL、覆盖和精确计价未独立核验；最后日 9/11。
- **原因及处理**：source_delayed、methodology_unverified；保留截止日与来源说明。
- **沿用的原始说明**：原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。 数据日落后当前UTC日期 3 天；缓存更新/本次采集时间不代表数据更新。 仅保留最新180天且最多1000行，按完整日期截取；实际显示覆盖见coverage。

### 36. `hl_hip3_and_crypto` — HIP-3 与 Crypto

- **来源 / 层级**：L2；原站公开缓存 / Dune；https://data.wublock123.com/api/hyperliquid/hip3_and_crypto。 记录上游：https://dune.com/queries/8077513；queryId=8077513；本项目不是直连该 Dune 查询。
- **结果 / 计划**：基线状态 `stale`，360 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day × category；USD (来源页面口径)；dimensions=["date","entity","category"]；measures=["value","daily_volume","open_interest"]。
- **数据时间**：asOf=2026-09-11；源缓存更新时间=2026-09-13T22:33:39Z；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:18:41+08:00。
- **覆盖**：保存日期=2026-03-16～2026-09-11，180 个日期；原响应=668 行，原始日期=2025-10-13～2026-09-11；截断=True。 保存实体 2 个。
- **已有可靠性证据**：2 类日成交和 OI：HIP-3/Crypto；同一 Dune 结果。
- **不足 / 不能确认**：分类边界及是否重叠待 SQL；不能与 official 当前 rolling 24h 横向相加。
- **原因及处理**：按日与分类显示，日历史和当前快照分开。
- **沿用的原始说明**：原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。 数据日落后当前UTC日期 3 天；缓存更新/本次采集时间不代表数据更新。 仅保留最新180天且最多1000行，按完整日期截取；实际显示覆盖见coverage。

### 37. `hl_fees_daily` — Hyperliquid 费用

- **来源 / 层级**：L4；原站转引 DefiLlama（受限）；https://data.wublock123.com/api/hyperliquid/hl_fees_daily。
- **结果 / 计划**：基线状态 `pending`，0 行；OFF。当前无数据成功记录；占位字段 fetchedAt=2026-09-14T16:23:42.533000Z，不得用作该项最后成功采集时间。
- **粒度 / 单位**：day × entity；USD；dimensions=["date","entity"]；measures=["value"]。
- **数据时间**：asOf=null；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=null。
- **覆盖**：保存日期=无逐日日期～无逐日日期，0 个日期；原响应=未记录 行，原始日期=未记录～未记录；截断=False。
- **已有可靠性证据**：现有采集器明确不给公开 bundle 输出受限费用数值；普通运行不会在线请求此源。
- **不足 / 不能确认**：现有研究文档记录该源转引 DefiLlama 且有再发布限制；本轮未重查条款。
- **原因及处理**：usage_restricted；由用户决定继续占位、确认适用许可或批准调查替代；不联系供应商。
- **沿用的原始说明**：原站响应明确 source=defillama。已取得的研究原始响应只存 restricted/；DefiLlama 条款限制未经许可再发布，公开 bundle 不含费用数值。保留费用 tab 待许可或其他适用来源。

### 38. `hl_volume_split` — Core / HIP-3 成交与 HyperEVM 费用

- **来源 / 层级**：L2；原站公开缓存 / Dune；https://data.wublock123.com/api/hyperliquid/hl_volume_split。 记录上游：https://dune.com/queries/8426019；queryId=8426019；本项目不是直连该 Dune 查询。
- **结果 / 计划**：基线状态 `stale`，180 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day × metric；USD；dimensions=["date","entity"]；measures=["value","core_daily_volume_usd","hip3_daily_volume_usd","hyperevm_fees_usd","total_trading_volume_usd"]。
- **数据时间**：asOf=2026-09-10；源缓存更新时间=2026-09-11T21:01:40Z；源查询执行完成=2026-09-11T01:04:14.600732Z；最后成功取得（北京时间）=2026-09-15T00:18:44+08:00。
- **覆盖**：保存日期=2026-03-15～2026-09-10，180 个日期；原响应=1210 行，原始日期=2023-05-20～2026-09-10；截断=True。 保存实体 1 个。
- **已有可靠性证据**：Core/HIP-3 日成交、HyperEVM 费用，源 query8426019；独立 rolling_24h 未混入日序列。
- **不足 / 不能确认**：推算费率列已去除；剩余 fees 列仍需 SQL 定义，不能用 fixed fee rate 推算替代实际手续费。
- **原因及处理**：source_delayed；保持日/24h 与真实/估计口径分开。
- **沿用的原始说明**：原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。 数据日落后当前UTC日期 4 天；缓存更新/本次采集时间不代表数据更新。 仅保留最新180天且最多1000行，按完整日期截取；实际显示覆盖见coverage。 data为日历史；响应独立rolling_24h快照未拼进日历史。隐含固定费率推算列按源说明已移除，不用于真实手续费。

### 39. `hl_hip3_by_category` — HIP-3 按类别

- **来源 / 层级**：L2；原站公开缓存 / Dune；https://data.wublock123.com/api/hyperliquid/hip3_by_category。 记录上游：https://dune.com/queries/8077405；queryId=8077405；本项目不是直连该 Dune 查询。
- **结果 / 计划**：基线状态 `stale`，994 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day × category；USD (来源页面口径)；dimensions=["date","entity","category"]；measures=["value","daily_volume"]。
- **数据时间**：asOf=2026-09-11；源缓存更新时间=2026-09-13T22:33:32Z；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:18:44+08:00。
- **覆盖**：保存日期=2026-04-23～2026-09-11，142 个日期；原响应=2048 行，原始日期=2025-10-13～2026-09-11；截断=True。 保存实体 7 个。
- **已有可靠性证据**：7 类日成交；最多 1000 行按完整日期保留。
- **不足 / 不能确认**：类别未证明互斥/穷尽，实际历史少于 180 天；页面 USD 仍未独立核价。
- **原因及处理**：展示实际覆盖，不从分类份额断言整体市场份额。
- **沿用的原始说明**：原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。 数据日落后当前UTC日期 3 天；缓存更新/本次采集时间不代表数据更新。 仅保留最新180天且最多1000行，按完整日期截取；实际显示覆盖见coverage。

### 40. `hl_by_category` — Hyperliquid 按类别

- **来源 / 层级**：L2；原站公开缓存 / Dune；https://data.wublock123.com/api/hyperliquid/hl_by_category。 记录上游：https://dune.com/queries/8077484；queryId=8077484；本项目不是直连该 Dune 查询。
- **结果 / 计划**：基线状态 `stale`，994 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day × category；USD (来源页面口径)；dimensions=["date","entity","category"]；measures=["value","daily_volume"]。
- **数据时间**：asOf=2026-09-11；源缓存更新时间=2026-09-13T22:33:38Z；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:18:46+08:00。
- **覆盖**：保存日期=2026-04-23～2026-09-11，142 个日期；原响应=2098 行，原始日期=2025-10-13～2026-09-11；截断=True。 保存实体 7 个。
- **已有可靠性证据**：7 类 Hyperliquid 日成交；原 Dune 查询。
- **不足 / 不能确认**：同名分类与 HIP-3 分类的覆盖边界待核；日切和 USD 尚需定义。
- **原因及处理**：source_delayed、methodology_unverified；标注样本范围。
- **沿用的原始说明**：原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。 数据日落后当前UTC日期 3 天；缓存更新/本次采集时间不代表数据更新。 仅保留最新180天且最多1000行，按完整日期截取；实际显示覆盖见coverage。

### 41. `hl_hip3_by_market` — HIP-3 按市场

- **来源 / 层级**：L2；原站公开缓存 / Dune；https://data.wublock123.com/api/hyperliquid/hip3_by_market。 记录上游：https://dune.com/queries/8077374；queryId=8077374；本项目不是直连该 Dune 查询。
- **结果 / 计划**：基线状态 `stale`，994 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day × market；USD (来源页面口径)；dimensions=["date","entity","market"]；measures=["value","cum_volume","daily_volume","open_interest"]。
- **数据时间**：asOf=2026-09-11；源缓存更新时间=2026-09-13T22:33:34Z；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:18:47+08:00。
- **覆盖**：保存日期=2026-04-23～2026-09-11，142 个日期；原响应=1890 行，原始日期=2025-10-13～2026-09-11；截断=True。 保存实体 7 个。
- **已有可靠性证据**：7 个 market 日成交、累计量与 OI。
- **不足 / 不能确认**：market 名称未等同官方 dex 命名空间；不能未经映射合并 official 表。
- **原因及处理**：先保存命名空间映射状态，source_delayed。
- **沿用的原始说明**：原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。 数据日落后当前UTC日期 3 天；缓存更新/本次采集时间不代表数据更新。 仅保留最新180天且最多1000行，按完整日期截取；实际显示覆盖见coverage。

### 42. `hl_symbol_latest` — HIP-3 按资产最新日 Top 50

- **来源 / 层级**：L2；原站公开缓存 / Dune；https://data.wublock123.com/api/hyperliquid/symbol?view=latestTop&n=50。
- **结果 / 计划**：基线状态 `stale`，50 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day × symbol；USD (来源页面口径)；dimensions=["date","entity","category","coin","symbol"]；measures=["value","oi","volume"]。
- **数据时间**：asOf=2026-09-11；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:18:47+08:00。
- **覆盖**：保存日期=2026-09-11～2026-09-11，1 个日期；原响应=50 行，原始日期=2026-09-11～2026-09-11；截断=False。 保存实体 50 个。
- **已有可靠性证据**：来源最新数据日 Top50；返回 volume/oi/category/coin/symbol。
- **不足 / 不能确认**：Top50 是截面样本；symbol 无可靠 dex 命名空间；“最新”截至 9/11，不是请求时间。
- **原因及处理**：identity_ambiguous；按实际数据日显示 Top50。
- **沿用的原始说明**：原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。 数据日落后当前UTC日期 3 天；缓存更新/本次采集时间不代表数据更新。 来源symbol/coin可能为显示标签，未可靠提供部署dex命名空间，不与官方dex:coin自动等同。

### 43. `hl_hip4` — HIP-4

- **来源 / 层级**：L2；原站公开缓存 / Dune；https://data.wublock123.com/api/hyperliquid/hip4。 记录上游：https://dune.com/queries/8077860；queryId=8077860；本项目不是直连该 Dune 查询。
- **结果 / 计划**：基线状态 `stale`，122 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day × metric；source native; USD待核；dimensions=["date","entity","network","window"]；measures=["value","active_markets","no_volume","trades","volume","yes_volume"]。
- **数据时间**：asOf=2026-09-01；源缓存更新时间=2026-09-02T22:45:33Z；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:18:48+08:00。
- **覆盖**：保存日期=2026-05-03～2026-09-01，122 个日期；原响应=122 行，原始日期=2026-05-03～2026-09-01；截断=False。 保存实体 1 个。
- **已有可靠性证据**：122 日 volume/yes/no/trades/active_markets 原值。
- **不足 / 不能确认**：币种和 network 含义不明；最新 9/1、缓存更新 9/2，明显源延迟。
- **原因及处理**：unit_unverified、source_delayed；不可标精确 USD。
- **沿用的原始说明**：原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。 数据日落后当前UTC日期 13 天；缓存更新/本次采集时间不代表数据更新。 Volume的原始响应未给币种；USD口径及Network含义待核验。

### 44. `hl_hyperevm_dex` — HyperEVM DEX

- **来源 / 层级**：L2；原站公开缓存 / Dune；https://data.wublock123.com/api/hyperliquid/hyperevm_dex。 记录上游：https://dune.com/queries/8426052；queryId=8426052；本项目不是直连该 Dune 查询。
- **结果 / 计划**：基线状态 `stale`，999 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day × project；USD；dimensions=["date","entity","project"]；measures=["value","trades","unique_traders","volume_usd"]。
- **数据时间**：asOf=2026-09-10；源缓存更新时间=2026-09-11T21:01:43Z；源查询执行完成=2026-09-11T01:04:17.401779Z；最后成功取得（北京时间）=2026-09-15T00:18:50+08:00。
- **覆盖**：保存日期=2026-03-30～2026-09-10，165 个日期；原响应=2623 行，原始日期=2025-02-18～2026-09-10；截断=True。 保存实体 7 个。
- **已有可靠性证据**：7 project 日成交、交易笔数、unique_traders；源说明每 DEX 独立去重。
- **不足 / 不能确认**：跨 DEX unique_traders 会重算地址；上限 999 行，源 2623 行，实际时段较短。
- **原因及处理**：不加成全链独立用户；保留日截止和截断说明。
- **沿用的原始说明**：原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。 数据日落后当前UTC日期 4 天；缓存更新/本次采集时间不代表数据更新。 仅保留最新180天且最多1000行，按完整日期截取；实际显示覆盖见coverage。 unique_traders 为各 DEX 各自去重,跨 DEX 相加会重复计算同一地址

### 45. `hl_symbol_series` — HIP-3 主要资产日历史

- **来源 / 层级**：L2；原站按资产公开缓存；https://data.wublock123.com/dashboard/hyperliquid。
- **结果 / 计划**：基线状态 `stale`，999 行；S2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：day × symbol；USD (来源页面口径)；dimensions=["date","entity","symbol"]；measures=["value","volume","oi"]。
- **数据时间**：asOf=2026-09-11；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:19:03+08:00。
- **覆盖**：保存日期=2026-05-24～2026-09-11，111 个日期；原响应=未记录 行，原始日期=未记录～未记录；截断=True。 保存实体 5 个。
- **已有可靠性证据**：仅最新 Top5 的历史；WTI/XYZ100/SPX/SKHX/BRENTOIL；重复键原 volume/oi 保留。
- **不足 / 不能确认**：WTI/SPX 同 date×symbol 多行缺 dex；重复值绘图 value=null；仅 XYZ100/SKHX/BRENTOIL 可按当前键画图。
- **原因及处理**：identity_ambiguous、sample_only；源 latestTop50 不等于 50 个资产历史均已接。
- **沿用的原始说明**：原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。 仅采样最新Top5资产的日历史；来源symbol尚未和官方dex:coin完成身份映射，其他资产不伪造历史。 原站WTI/SPX等存在同日多行且无dex维度；保留原volume/oi，重复date×symbol的标准绘图value置null，禁止擅自相加。
- **实际多个读取 URL**：https://data.wublock123.com/api/hyperliquid/symbol?view=series&symbol=WTI、https://data.wublock123.com/api/hyperliquid/symbol?view=series&symbol=XYZ100、https://data.wublock123.com/api/hyperliquid/symbol?view=series&symbol=SPX、https://data.wublock123.com/api/hyperliquid/symbol?view=series&symbol=SKHX、https://data.wublock123.com/api/hyperliquid/symbol?view=series&symbol=BRENTOIL
- **采样资产 / 可绘制资产**：WTI、XYZ100、SPX、SKHX、BRENTOIL / XYZ100、SKHX、BRENTOIL

### 46. `hl_markets_snapshot` — Hyperliquid 官方市场快照

- **来源 / 层级**：L1；Hyperliquid 官方 info API；https://api.hyperliquid.xyz/info。
- **结果 / 计划**：基线状态 `review`，200 行；C2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：current snapshot；USD-pegged quote notional; no FX adjustment；dimensions=["date","entity","dex","coin"]；measures=["value","volume_24h_usd","oi_usd_mark","oi_native","mark_price","oracle_price","funding_hourly"]。
- **数据时间**：asOf=2026-09-14T16:19:17.286109Z；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:19:17+08:00。
- **覆盖**：保存日期=2026-09-14～2026-09-14，1 个日期；原响应=未记录 行，原始日期=未记录～未记录；截断=True。 保存实体 200 个。
- **已有可靠性证据**：官方 POST perpDexs+spotMeta+各 dex metaAndAssetCtxs；11/11 dex，519 universe，展示成交量 Top200。
- **不足 / 不能确认**：USD 名义来自 USDC/USDE/USDH/USDT0，不做汇率转换；全采样约 10 秒无统一 server time；current snapshot 不是日历史。
- **原因及处理**：quote_unadjusted、sample_only；OI=原币数量×markPx；完整 namespace 与逐行 observed_at 保留。
- **沿用的原始说明**：官方无签名当前快照；默认Core与HIP-3逐DEX枚举。OI名义额=原生数量×标记价，未乘2；*_usd字段为源名义口径，非经过稳定币/法币汇率换算的美元金额。不同DEX使用USDC/USDH/USDE/USDT0，必须展示quote_symbol，不能把未换汇合计称精确法币USD。获取时间是采样时间，不是历史数据日。API再发布条件未作授权保证。

### 47. `hl_dex_totals_snapshot` — Hyperliquid 官方DEX汇总

- **来源 / 层级**：L1；Hyperliquid 官方 info API；https://api.hyperliquid.xyz/info。
- **结果 / 计划**：基线状态 `review`，11 行；C2。当前采集器会请求既有来源；下一次运行成功与否待执行日志证明。
- **粒度 / 单位**：current snapshot；USD-pegged quote notional; no FX adjustment；dimensions=["date","entity","dex"]；measures=["value","volume_24h_usd","oi_usd_mark","asset_count"]。
- **数据时间**：asOf=2026-09-14T16:19:17.286109Z；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=2026-09-15T00:19:17+08:00。
- **覆盖**：保存日期=2026-09-14～2026-09-14，1 个日期；原响应=未记录 行，原始日期=未记录～未记录；截断=False。 保存实体 11 个。
- **已有可靠性证据**：官方 519 universe 全部记录汇总为 11 dex，非仅 Top200 相加。
- **不足 / 不能确认**：报价资产混合，无统一观测时刻；volume 为 rolling24h，不能与自然日 volume 无说明比较。
- **原因及处理**：quote_unadjusted；标名义报价汇总，不称精确法币 USD。
- **沿用的原始说明**：官方无签名当前快照；默认Core与HIP-3逐DEX枚举。OI名义额=原生数量×标记价，未乘2；*_usd字段为源名义口径，非经过稳定币/法币汇率换算的美元金额。不同DEX使用USDC/USDH/USDE/USDT0，必须展示quote_symbol，不能把未换汇合计称精确法币USD。获取时间是采样时间，不是历史数据日。API再发布条件未作授权保证。

### 48. `dex_spot_market_share` — DEX 现货市场份额

- **来源 / 层级**：L4；DefiLlama（受限）；https://api.llama.fi/overview/dexs。
- **结果 / 计划**：基线状态 `pending`，0 行；OFF。当前无数据成功记录；占位字段 fetchedAt=2026-09-14T16:23:42.597884Z，不得用作该项最后成功采集时间。
- **粒度 / 单位**：day × entity；USD；dimensions=["date","entity"]；measures=["value"]。
- **数据时间**：asOf=null；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=null。
- **覆盖**：保存日期=无逐日日期～无逐日日期，0 个日期；原响应=未记录 行，原始日期=未记录～未记录；截断=False。
- **已有可靠性证据**：0 行；源 URL 是候选 DefiLlama，当前默认运行不获取其数据。
- **不足 / 不能确认**：历史本地审计称免费技术可读但再发布受限；没有已批准替代分母/来源；本轮未新调用。
- **原因及处理**：usage_restricted；保留待接入，用户决定许可处理或是否允许替代源；不自行删除。
- **沿用的原始说明**：免费接口技术可读，但DefiLlama条款限制未经许可的数据再发布；不将受限数据并入公开bundle。获得适用许可/替代来源后，用同日期breakdown及同一覆盖分母计算，现货与永续分开。

### 49. `dex_perp_market_share` — DEX 永续市场份额

- **来源 / 层级**：L4；DefiLlama Pro（未接入）；https://api-docs.defillama.com/llms.txt。
- **结果 / 计划**：基线状态 `pending`，0 行；OFF。当前无数据成功记录；占位字段 fetchedAt=2026-09-14T16:23:42.597888Z，不得用作该项最后成功采集时间。
- **粒度 / 单位**：day × entity；USD；dimensions=["date","entity"]；measures=["value"]。
- **数据时间**：asOf=null；源缓存更新时间=null；源查询执行完成=null；最后成功取得（北京时间）=null。
- **覆盖**：保存日期=无逐日日期～无逐日日期，0 个日期；原响应=未记录 行，原始日期=未记录～未记录；截断=False。
- **已有可靠性证据**：0 行；当前 source.url 是文档，不是采集接口。
- **不足 / 不能确认**：本地审计记录 derivatives 成交接口 Pro-only；未注册/付费；免费 OI 不等同成交份额。
- **原因及处理**：paid_or_key_required；等待用户选择，当前不开启自动请求。
- **沿用的原始说明**：官方文档将derivatives成交量API列为Pro-only；没有注册密钥或付费。免费OI不等于成交量，不替换指标。

## 数据集之外的 UI 占位与 AI 组件

|ID（建议稳定登记名）|原 UI 位置|来源 / 层级|当前可确认|无法给出数据的原因|粒度 / 采集计划 / 源时间|后续动作|
|---|---|---|---|---|---|---|
|funding_zscore|CEX 资金费率 → Z-score|D；依赖 funding_btc / funding_oi_btc / funding_vol_btc，尚未选择方法|有费率原值，不等于已有可用 Z-score|methodology_unapproved + unit_unverified；窗口、频次、时区和结算周期未统一|待确认标的×场所×时间窗口；OFF；源时间继承待选输入|保留占位，批准方法后以同口径序列计算；不需先引新来源|
|aggregated_other|CEX 聚合成交量 → 其他资产|L4；既有聚合成交接口同家族候选；现代码只硬编码 BTC|BTC 现货/合约已取，不能代表其他资产|not_implemented / not_individually_validated；不能宣称接口一定不给|拟日×标的×现货/合约；OFF；asOf / lastSuccessfulFetchedAt=null|先确定标的清单，再在已有来源能力内逐标的核验；不得自动新增任意资产|
|ai_market_insight（建议名，现 UI 无此数据 ID）|全站 AI 市场解读|L4；没有模型/生成管道|保留静态“待接入”面板|no_model_configured；模型/身份/免费额度和摘要质量规则未确认|每日内容组件；OFF；生成时间=null，证据数据水位独立|用户批准生成方案后按有效数据输出；规则摘要须标数据摘要，不能冒称 AI|

## 27 个非 Stocks 板块历史占位

下面每行都有**已读目录标签与 pairCount**，但**没有该标签的成交/OI/资金费率/对比明细**。目录共 28 类，Stocks 已另接。各标签可能重叠，pairCount 不可跨标签加为独立交易对总数。它们是原站目录保留内容，不在本轮自行缩为股票/商品/外汇，也不自行增删 crypto 类别。当前目录没有 Forex，不能因旧举例擅自增加。

共同来源：已接目录 L2 `https://data.wublock123.com/api/coinglass/futures/tradfi-volume-overview?source=tag&labels_only=1`；历史候选是该已知接口家族的 label 参数，但**本轮未请求**。共同状态 `pending/not_individually_validated`，当前计划 OFF、源业务时间 null、历史 lastSuccessfulFetchedAt null；目录成功读取时间为 2026-09-15T00:12:46+08:00。`funding / compare` 不能因为成交历史以后成功就自动标 ready。

|当前动态 UI ID|目录板块|已读 pairCount|历史/指标状态与缺失原因|
|---|---|---:|---|
|`sector_Layer 1 (L1)`|Layer 1 (L1)|586|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Decentralized Finance (DeFi)`|Decentralized Finance (DeFi)|514|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Binance Alpha Spotlight`|Binance Alpha Spotlight|484|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Made in USA`|Made in USA|434|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Meme`|Meme|303|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Artificial Intelligence (AI)`|Artificial Intelligence (AI)|299|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Proof of Work (PoW)`|Proof of Work (PoW)|171|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_NFT`|NFT|170|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Decentralized Exchange (DEX)`|Decentralized Exchange (DEX)|169|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Layer 2 (L2)`|Layer 2 (L2)|165|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Real World Assets (RWA)`|Real World Assets (RWA)|160|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_World Liberty Financial Portfolio`|World Liberty Financial Portfolio|151|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Gaming (GameFi)`|Gaming (GameFi)|136|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Zero Knowledge (ZK)`|Zero Knowledge (ZK)|128|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_DePIN`|DePIN|111|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Commodities`|Commodities|100|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Privacy`|Privacy|99|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Indices`|Indices|96|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Alleged SEC Securities`|Alleged SEC Securities|86|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Wallets`|Wallets|34|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_SocialFi`|SocialFi|31|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Storage`|Storage|29|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Centralized Exchange (CEX) Token`|Centralized Exchange (CEX) Token|22|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Stablecoins`|Stablecoins|16|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Stock market-themed`|Stock market-themed|15|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Prediction Markets`|Prediction Markets|7|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|
|`sector_Chinese Meme`|Chinese Meme|3|待接入；当前采集器仅请求 Stocks，未逐项验证此板块历史/费率/OI/对比；不是技术不可获取的结论。|

## 实施中 7 个派生 ID 的登记建议（不算新外部来源）

只读检查时 `lib/catalog.ts` / `lib/data.ts` 已出现下列实现。此处提供来源依赖，不对仍在编辑的实现作最终验收。来源层级 D；计划 DERIVED；不得伪造独立 fetchedAt。

|ID|依赖|粒度 / 单位|公式与边界|
|---|---|---|---|
|cex_spot_daily_share|cex_spot_daily|日×场所 / %|单所 ÷ 同日列示场所之和；排除 ALL/Total；来源含 DEX，标样本份额。|
|cex_futures_daily_share|cex_futures_daily|日×场所 / %|同上；现货与合约分母不同，不互换。|
|cex_spot_monthly_share|cex_spot_monthly|月×场所 / %|同月有效输入；月份语义沿用原月表。|
|cex_futures_monthly_share|cex_futures_monthly|月×场所 / %|同上；任一必要场所缺报不能把其他场所比例默默扩大。|
|cex_reserves_daily_share|cex_reserves_daily|日×场所 / %|只是公开资产样本份额；不是偿付能力或储备可信度。|
|cex_futures_spot_ratio_daily|cex_spot_daily + cex_futures_daily|日×共同场所 / 倍|同平台同日期合约÷现货；现货≤0/缺值不计算；继承最旧输入水位及双方质量。|
|cex_futures_spot_ratio_monthly|cex_spot_monthly + cex_futures_monthly|月×共同场所 / 倍|同上，按同月份；不得只继承现货来源而丢合约 lineage。|

## Registry 建议最小字段与实施检查

```ts
type SourceRegistryEntry = {
  id: string; recordKind: 'dataset' | 'derived' | 'placeholder' | 'content';
  panelIds: string[]; metricFamily: string; approvedScope: string;
  sourceTier: 'L1' | 'L2' | 'L3' | 'L4' | 'D';
  sourceName: string | null; sourceUrl: string | null;
  upstreamUrl: string | null; upstreamAccess: 'direct' | 'via_origin' | 'candidate' | null;
  collector: string | null; dependencyIds: string[];
  grain: string; unitsByMeasure: Record<string,string>; entityScope: string;
  availability: 'available' | 'partial' | 'pending';
  reliabilityEvidence: string[]; gaps: string[]; missingReason: string | null;
  usageStatus: 'unverified' | 'restricted' | 'confirmed';
  schedule: { timezone:'Asia/Shanghai'; times:string[]; enabled:boolean; };
  checkedAt: string | null; lastSuccessfulFetchedAt: string | null;
  sourceUpdatedAt: string | null; sourceExecutionEndedAt: string | null;
  asOf: string | null; asOfBasis: string; periodComplete: boolean | null;
  sourceCoverage: object; retainedCoverage: object;
  nextAction: string; userDecisionNeeded: string | null;
};
```

- mixed 单位表需要 unitsByMeasure，不能整张 table 统一显示 USD/%；原 raw source-rate 仍待核的字段不能自动算年化或增长率。
- 采集计划逐项显示。失败、空响应、源无新发布与日期延迟分开；“计划每天检查”不是“上游每天有数据”。
- `available` 只指拿到表，`partial` 指覆盖/样本有界；质量、时效和公开使用独立状态，不能用单个 ready 混合决定。
- 每次发布至少校验字段类型/单位、关键粒度唯一性、日期水位、必需系列与上次相比的消失，派生分母非零及输入周期一致；不把异常直接变 0。
- PRD 覆盖以原关键组件及必需筛选为分母；28 类目录、50 行最新资产、5 个资产历史分别登记，不能一个成功就抵销同模块其余缺项。
- 本次工作并未访问新接口，因此不能给 27 板块、其他资产或受限源下“确实无法获取”的结论；目前可确认的是未接/受限/未核原因。

## 本地证据文件

- `/Users/raymond/Documents/ChatGPT/web3 data/web/data/bootstrap.json`
- `/Users/raymond/Documents/ChatGPT/web3 data/web/scripts/fetch_cex.py`
- `/Users/raymond/Documents/ChatGPT/web3 data/web/scripts/fetch_decentralized.py`
- `/Users/raymond/Documents/ChatGPT/web3 data/web/scripts/collect.py`
- `/Users/raymond/Documents/ChatGPT/web3 data/web/.github/workflows/update-data.yml`
- `/Users/raymond/Documents/ChatGPT/web3 data/web/lib/catalog.ts`
- `/Users/raymond/Documents/ChatGPT/web3 data/web/lib/data.ts`
- `/Users/raymond/Documents/ChatGPT/web3 data/web/components/dashboard.tsx`
- `/Users/raymond/Documents/ChatGPT/web3 data/web/docs/PRD.md`
- `/Users/raymond/Documents/ChatGPT/web3 data/web/docs/SPEC.md`
- `/Users/raymond/Documents/ChatGPT/web3 data/web/docs/DATA_SOURCES.md`
- `/Users/raymond/Documents/ChatGPT/web3 data/web/docs/research/origin-data-audit.md`
- `/Users/raymond/Documents/ChatGPT/web3 data/web/docs/research/dex-hyperliquid-audit.md`

备注：lib/catalog.ts、lib/data.ts、quality.ts 与 UI 在父任务中继续修改；本报告的快照证据固定来自上述 bootstrap，不把原审计发现重复描述成修改后的当前故障。源集中、时间语义、样本覆盖和单位缺口需由新 registry 明确承载。
