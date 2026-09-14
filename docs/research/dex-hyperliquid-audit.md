# DEX 市场份额与 Hyperliquid 数据核验

调研日期：2026-09-14。状态：供 PRD / Spec 决策使用的只读核验，不是已获批准的实施方案。本轮未安装插件、注册账户、购买 API、接入生产系统或发布网页。

## 结论

1. DEX **现货成交量市场份额**有免费、无密钥的技术来源。DefiLlama 全市场、按链、协议版本及日历史均已实测取得。但其公开再发布条款需要先解决，不能把“免费访问”写成“已获公开使用许可”。
2. DEX **永续成交量市场份额**需要独立口径。DefiLlama 最新官方目录已把 derivatives 成交量接口列为 Pro-only；历史上公开可读不代表当前免费方案承诺。不能把免费 OI 接口当作成交量份额的替代。
3. Hyperliquid 自身当前市场数据、日 K 线和小时资金费率已实测取得。完整多年 OI / 24h 成交量快照历史不能仅靠当前 info 响应补齐；官方 S3 历史的请求者承担传输费，不属于此次零付费接入范围。
4. 推荐向用户确认“DEX 市场份额先做现货，永续单独保留待接入”，或“现货 / 永续两个 tab，永续在获得适用来源后上线”。不得未经确认增加两个栏目，也不得混在一张饼图中。

## 1. DEX 实测结果与颗粒度

通过 HTTPS 对官方无密钥公开接口作少量只读请求，成功响应为 HTTP 200。首次部分请求发生 TLS EOF，有限重试成功；这证明可获取，尚不构成稳定性验收。

| 请求 | 2026-09-14 实测结果 | 可支撑的颗粒度 |
|---|---|---|
| `GET https://api.llama.fi/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true` | 1,357 条协议记录；有 `total24h`、`total7d`、`total30d`、`parentProtocol`、`chains`、`breakdown24h`、`breakdown30d`、`methodology` | 协议版本 / 品牌映射、全链或单链、近期窗口快照 |
| 同接口，两个 `exclude...` 参数均设为 `false` | `totalDataChart` 和 `totalDataChartBreakdown` 各 4,593 个日点；时间戳覆盖 2014-02-17 至 2026-09-14 | 全市场日总量；各协议日成交量；可按统一日窗计算份额历史 |
| `GET https://api.llama.fi/overview/dexs/ethereum?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true` | 163 条协议记录 | Ethereum 内的 DEX 量和份额；其他链应从响应 `allChains` 枚举，不靠猜名称 |
| `/summary/dexs/{protocol}` | 官方免费目录有说明，本轮未逐协议实测 | 单协议量历史与链分解候选；历史开始时间必须逐协议核验 |

上述 4,593 日是**市场历史系列**，不代表每一个 DEX 都具有同样长度或完整度。最新日包含未结束的当天数据，不能直接标为完整昨日数据。[免费 API 文档](https://api-docs.defillama.com/llms-free.txt)

### 1.1 不能混用分子分母

同次响应观察到：

| 值 | USD |
|---|---:|
| 顶层 `total24h` | 7,121,144,015.46 |
| 逐协议 `total24h` 相加 | 8,463,347,759.89 |
| 2026-09-13 的日图总量 | 7,075,837,859.46 |
| 2026-09-13 的同日 breakdown 相加 | 7,075,837,859.46 |

这不是四舍五入差异。它可能涉及不同时间窗、数据回补和更新节奏；本轮未完全验证各 `total24h` 的内部生成算法，不能擅自解释为同一个滚动 24 小时窗口。官方 adapter 文档同时支持任意区间及固定 UTC 日两类采集方式。[指标构建说明](https://docs.llama.fi/list-your-project/other-dashboards)

**建议规格：**首页份额默认取最近一个已结束并通过完整性检查的 UTC 日，直接用该日期 `totalDataChartBreakdown` 中相同范围的协议量作分子和分母。7 日、30 日使用同一组日期重算；窗口和时区在图旁可见。顶层快照如展示，独立标注来源窗口，不能参与另一口径的份额计算。

本轮对 9 月 12、13、14 日核验，同日 breakdown 合计均与同日日图总量一致。9 月 13 日有 1,004 个 breakdown 名称，而整个元数据表有 1,357 条；缺失不能补成 0。样本中同一协议在不同日期的存在性有变化，需记录覆盖变化，不能把缺报解释为市场份额归零。

### 1.2 防止重复统计

- 品牌视图建议按 `parentProtocol` 聚合互不重叠的协议版本。例如 Uniswap V1/V2/V3/V4 可映射到 Uniswap，但映射和版本纳入范围需要登记；不能同时再加一个父协议总量。
- 全链数据已经覆盖多链，不可再与各链总量相加。选择单链时分子和分母都来自该链。
- DEX 现货、DEX 聚合器、永续、期权是不同集合；不能把聚合器路由量再次加入底层 DEX 成交量。本轮用户已排除的期权不重新引入。
- 显示 Top 10 + 其他时，“其他”只能等于同一已覆盖分母减去 Top 10，不能代表未追踪的整个世界市场。标题应写“已覆盖 DEX 的现货成交量份额”，注明来源覆盖。
- 跨日份额变动用百分点；同时披露新增 / 缺报协议造成的覆盖变化。暂停、下架、无成交、采集缺失应分别处理。

### 1.3 永续数据的免费边界

截至本轮，DefiLlama 官方 [API 总目录](https://api-docs.defillama.com/llms.txt) 将 `/api/overview/derivatives`、`/api/summary/derivatives/{protocol}` 列为 Pro-only；`/overview/open-interest` 仍在免费目录。未调用付费接口，也未注册密钥。

建议把全市场永续**成交量**份额标为“来源方案待确认”；若后续逐平台直采，只能展示明确的样本集合份额，且需要用户同意该口径，不能暗称完整行业份额。OI 份额衡量存量风险敞口，与成交量份额不同，不自行替换。

## 2. Hyperliquid 实测结果与颗粒度

以下均为 `POST https://api.hyperliquid.xyz/info` 的无签名、只读请求，不需要交易授权。

| 请求 body | 本轮实测 | 可展示内容 |
|---|---|---|
| `{"type":"perpDexs"}` | 11 个条目：默认 `null` 加 10 个命名 dex | 默认市场与 HIP-3 子市场清单 |
| `{"type":"metaAndAssetCtxs"}` | 默认市场 `universe` 与 contexts 均 234 条 | 各合约标记价、预言机价、中间价、前日价、24h 名义成交量、基础币成交量、OI、当前 funding |
| `{"type":"metaAndAssetCtxs","dex":"xyz"}` | universe / contexts 均 120 条；含 `xyz:XYZ100`、`xyz:TSLA` 等 | 一个 HIP-3 市场的逐合约数据，验证不能只采默认 dex |
| BTC `candleSnapshot`，`1d`，2026-09-11 至 2026-09-14 00:00 UTC | 4 条，最后一条是 9 月 14 日仍未结束的 K 线 | OHLC、基础币量 `v`、成交笔数 `n`、开闭时间 |
| BTC `fundingHistory`，2026-09-12 至 2026-09-14 00:00 UTC | 48 条 | 每小时资金费率、premium、时间戳 |

这两个 universe 数是返回的合约元数据记录数，可能含下架等状态，不能直接显示为“活跃交易对数”。默认和 HIP-3 需动态枚举及记录 coverage；本轮只实测默认及 xyz，未声称 10 个 HIP-3 全部完成数据验收。[永续 info 文档](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals)

本轮 10 个 HIP-3 dex 名称：`xyz`、`flx`、`vntl`、`hyna`、`km`、`abcd`、`cash`、`para`、`mkts`、`io`。生产实现应每次枚举，不能固化这份名单。以 `dex + coin` 为标识，不按基础 ticker 去重不同产品；默认市场与 HIP-3 可以提供范围切换，但总量必须先完成全覆盖与相同计价检查。

官方最新文档另列 `allPerpMetas`，示例包含各 perp dex 的 metadata / contexts，可作为降低请求数的候选，但本轮未实测；首版不能在验证前依赖该示例结构。`perpDexStatus` 文档还提供 `totalNetDeposit` 快照，未实测，也不能直接当成日净流入。

### 2.1 单位与历史限制

- **OI：**保留原生数量，再按指定估值价换算名义金额。建议统一使用 `openInterest × markPx` 并明确名称“按标记价估值的 OI”；不要直接给 `openInterest` 加美元符号，也不要无依据乘 2。不同产品 / 抵押资产需保留对应计价规则。[API 记号](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/notation)、[合约规格](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/contract-specifications)
- **成交量：**`dayNtlVlm` 是名义金额，`dayBaseVlm` / candle `v` 是基础数量。不能用一天 OHLC 中一个价格乘 candle `v`，冒充真实日美元成交量。当前滚动 / 日统计快照与已完成 UTC 日图分开存储。
- **资金费率：**官方按小时支付；显示原周期、转换规则及时间，不能把小时值当作 CEX 的 8 小时值。[Funding 文档](https://hyperliquid.gitbook.io/hyperliquid-docs/trading/funding)
- **K 线：**官方只保留最近 5,000 根，支持分钟到月；是按周期的根数限制，不是任意分钟历史可回溯。1 分钟理论约 3.47 天，1 小时约 208 天，实际仍受上市时间 / 缺失限制。返回开端落在 `endTime` 的当天未完成 candle 必须过滤或明确标识。[Info endpoint](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint)
- **OI 长历史：**当前 contexts 不含完整历史。第一版可从启用采集日开始保存每日快照；不能用价格历史推导旧 OI。
- **官方归档：**S3 有资产上下文和盘口等，但官方说明请求者支付传输费、约按月上传且可能缺失。因此此次不下载；如需要多年 OI 或成交明细回补，应单独列预算与方案让用户决策。[历史数据说明](https://hyperliquid.gitbook.io/hyperliquid-docs/historical-data)
- **资金流 / 用户 / 清算 / 收入：**上述成功响应本身不提供全平台日新增用户、全平台净流入、完整清算总额或精确收入。不能用少量地址、当前 OI 或成交量简单推断这些指标；需独立来源与定义，保留栏目等待核验。
- **HIP-3 股票相关合约：**股票价格敞口的永续合约不等于代币化股票实际发行存量，不能用于“代币化股票市值 / 持有人 / 托管股票余额”统计。

### 2.2 每日运行可行性

每日获取一轮 dex 元数据 / contexts 加少量历史查询，技术负载很低。官方当前 REST 按 IP 加权上限为每分钟 1,200；多数 info 请求权重 20，candles 还按返回数量加权。部署时做限速、重试、原子发布及失败保留上版，不把对话中成功调用等同于运行环境验收。[速率限制](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits)

## 3. 免费访问、公开展示和插件边界

| 来源 | 技术访问 | 公开网站使用结论 |
|---|---|---|
| DefiLlama | 免费公开接口已实测 | **许可待解决。**官方 Terms 适用范围包含 public APIs，限制未经许可的数据再发布及商业使用。只加署名不能自动消除限制。先向用户提出取得许可 / 替代源的选择，不能擅自联系供应商或付费。[条款](https://defillama.com/terms) |
| Hyperliquid | 官方只读 API 已实测，无 key | 本轮未发现明确授权所有第三方商业再发布的 API 数据许可，也未找到可据以承诺免费的 SLA。可作为技术优先候选，但文档应保留“公开使用条件复核”，不作无条件许可保证。[官方 API](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api) |
| Plugin | 当前已加载工具中未发现 DefiLlama 或 Hyperliquid 专用工具 | 没有证据表明需安装新插件。直接 API 更适合部署后的日采集；插件即使能在对话中查数据，也不自动带来服务器凭据、历史覆盖或再发布许可。 |

## 4. 交给 PRD / Spec 的待确认项

1. 新增 DEX 市场份额选择“现货先上线”还是“现货 / 永续独立 tab，未解决来源者保留待接入”。
2. 是否接受默认按最近完整 UTC 日展示份额，并提供一致的 7 日 / 30 日窗口；现货各协议版本按品牌汇总但可展开。
3. DefiLlama 许可如何处理：取得适用许可后接入，或允许另选数据源 / 样本口径；本轮不擅自发送咨询或付费。
4. Hyperliquid 默认与 HIP-3 是否首版都纳入；如纳入，应按已验证覆盖提供拆分，股票相关永续单独标注产品性质。
5. 历史缺口接受“自采集日起积累 / 历史待接入”；付费 S3 回补只作后续建议。

以上建议不改变用户已确认的栏目保留 / 删除边界，不把当前可取到的额外指标自动加入第一版。
