# 数据插件与候选 API 审计

核查日期：2026-09-14。状态：方案评审资料，不代表接入、注册、安装、采购或上线已获批准。

本报告只覆盖 CEX（无网站流量、无期权）、DEX（无 Uni Burn，增加交易所市场份额）、代币化股票、Hyperliquid。受众为高管与营销团队；公开网站、每日更新、免费数据源优先。此轮没有读取账户、持仓、订单或交易资料，没有执行任何交易或内容发布。

## 1. 结论

- 现有 CoinGecko 插件已实测可以取得 **NVIDIA xStock 的代币行情和 30 天图表**，以及 **HYPE 代币行情**。这对代币化股票栏目和 Hyperliquid 的代币卡片有帮助。
- 现有插件不能单独覆盖整站：本会话暴露的 CoinGecko、CoinMarketCap、OKX 工具没有完整的交易所级历史成交额、DEX 份额、全量代币化股票持有人/发行量或 Hyperliquid 协议运营数据接口。
- 正式网站应按指标选用经确认的官方 REST API；插件用于前期取样、来源交叉检查和人工分析。会话可调用、接口免费、允许公开使用、能够定时部署，是四个需要分别验证的条件。
- 不建议第一版为此新增付费 MCP。DefiLlama 免费 REST API 与它的付费 MCP 是不同服务；CoinGlass MCP 也需要 API key 与相应额度。
- “AI 解读”可以保留，但目前没有核实并授权一个可在云端长期免费运行的生成模型。应将其作为独立决策项，不能把普通模板文本标成 AI，也不能承诺现有聊天订阅会自动承担网站生成成本。

## 2. 已暴露工具的适配范围

以下依据本会话 ALL_TOOLS 的真实工具定义。标注“定义确认”的能力未在本轮全部调用，不代表每种标的及历史范围已经通过验收。

| 已有插件 | 范围内可用能力与颗粒度 | 本范围的缺口 | 建议角色 |
|---|---|---|---|
| CoinGecko（11 个工具） | 币种/代币 ID 搜索；单币或最多 20 个币的最新价格、市值、FDV、流通量、24h 量；单币指定日期 00:00 UTC 快照；1/7/30/90/365 天、Max/YTD 图表；板块快照 | 本会话工具没有交易所排名/市场份额、交易所历史量、逐链合约持有人统计；图表工具是简化输出 | 代币化股票与 HYPE 行情候选；数据解释与核查 |
| CoinMarketCap（12 个工具） | 币种搜索与最新报价；1h、24h、7d、30d 等变动；全球衍生品快照（OI、资金费率、BTC 清算等，需逐字段核对）；叙事表现、关联币种 | 本会话工具未提供交易所级成交额历史、DEX 交易所份额、代币化股票发行方/链分布接口；全球衍生品不等于各家 CEX 分拆 | CEX 衍生品汇总对照、代币行情备选；不作为全站唯一源 |
| OKX（3 个工具） | 单币 K 线，工具参数含日/周/月、历史天数；涨跌榜；2–10 币对比 | 单一平台币种行情不能代替全市场 CEX 成交额、市场份额或储备；本会话无 Hyperliquid 协议指标 | 交易所报价校验；第一版不新增专门栏目 |
| Longbridge（136 个工具，其中包含账户/交易功能，本轮未调用） | 传统证券最新行情；日内及日/周/月/年 OHLCV；单次 K 线最多 1,000 条且受权限影响；证券资料与财报等 | NVDA.US 是传统证券报价，不是 NVDAX、NVDAon 等代币市场；不能提供这些代币的流通量、链上量或 DEX 持有人 | 若将来用户批准“代币与底层股票偏离”指标，可做底层参照；不是代币化股票主源 |

CoinGecko 的涨跌幅排行工具明确需要 Pro key，免费方案不应默认接入。新闻、叙事、传统股票新闻虽然工具可读，但用户本轮只保留 AI 解读、不要求新闻正文，故不建议顺手增加内容。

精确工具名（方便开发复核）：

- CoinGecko：`mcp__codex_apps__coingecko_search_coins`、`..._get_coin_markets`、`..._get_coin_market_chart`、`..._get_coin_history`、`..._get_coin_info`、`..._get_categories`。
- CoinMarketCap：`mcp__codex_apps__coinmarketcap_search_cryptos`、`..._get_crypto_quotes_latest`、`..._get_global_crypto_derivatives_metrics`、`..._trending_crypto_narratives`。
- OKX：`mcp__codex_apps__okx_gateway_crypto_chart`、`..._crypto_rank`、`..._token_comparison`。
- Longbridge：`mcp__codex_apps__longbridge_quote`、`..._candlesticks`、`..._history_candlesticks_by_date`、`..._static_info`。

## 3. 本轮新增只读样本（共 3 次插件调用）

### 3.1 代币身份搜索

调用 CoinGecko 搜索 `NVIDIA xStock`，成功返回两个不同实体：

| ID | 名称 | Symbol | 本轮返回排名 |
|---|---|---|---|
| `nvidia-xstock` | NVIDIA xStock | NVDAX | 549 |
| `wrapped-nvidia-xstock` | Wrapped NVIDIA xStock | WNVDAX | null |

含义：同一底层股票对应的原生代币、封装代币必须分别建档。不可仅靠 `NVDA` 文字合并；发行方、产品、链与合约地址应纳入身份键。xStocks 官方将其产品描述为底层股票/ETF 的代币化表示，并列有产品与合约信息。[xStocks 官方产品](https://xstocks.com/us/products)、[xStocks 说明](https://xstocks.com/)

### 3.2 代币最新快照

一次查询 `nvidia-xstock` 与 `hyperliquid`，成功返回以下样本。数值只证明可获取字段，不作为报价或运营结论使用。

| 字段（USD，除数量和百分比） | NVIDIA xStock | HYPE |
|---|---:|---:|
| 当前价格 | 212.32 | 79.91 |
| 市值 | 38,928,134 | 17,783,301,627 |
| 24h 成交量 | 7,441,184 | 724,716,715 |
| 24h 价格变化 | -1.58938% | +2.32556% |
| 流通数量 | 183,341.87495603602 | 222,445,714.07414138 |
| FDV | 217,325,257 | 76,371,504,891 |
| 7d sparkline 点数 | 48 | 48 |

限制：此工具返回值没有独立的上游 `last_updated`，sparkline 没有逐点时间戳。不能把采集时间自动当成市场数据时间，也不能从 48 个点反推精确小时数据。HYPE 的代币成交量不能替代 Hyperliquid 永续合约成交量、协议收入或现货成交量。NVDAX 市值也不能替代“全市场代币化股票规模”。

### 3.3 30 天图表

对 `nvidia-xstock` 查询 30 天图表：成功返回 120 个价格值、120 个市值值，起点 `2026-08-15T16:00:00Z`，终点 `2026-09-14T15:51:40Z`。

限制：只有起止时间与两组数组，没有每个点的原始时间、OHLC、成交量历史。因此可证明“展示级趋势图可取得”，不能据此承诺标准日线、任意区间收益计算或原始历史下载。正式存储需要从经批准的 API 取得每点时间戳，再进行日级聚合；没有时间戳的图表输出不能伪造成正式时序数据。

本轮未重复此前会话已经验证的 CoinGecko 板块、CMC 衍生品、OKX BTC 图表；它们仅按既有结果与工具定义列入适配判断，未当成新的完整验收结果。

## 4. 候选 API / MCP 与决策建议

ALL_TOOLS 未发现 DefiLlama、CoinGlass 可调用工具，也未暴露 `search_plugins` / `suggest_plugins`。这只说明当前会话没有这些能力；不能宣称插件目录中不存在，亦不能宣称其有可一键安装的 Codex 插件 ID。下面是官网核实的服务候选，本轮没有连接或安装。

| 候选 | 本次确认 | 第一版建议 |
|---|---|---|
| DefiLlama 免费 REST API | 官方文档列出无鉴权免费 API，包括 DEX 成交量总览/单协议历史、TVL、费用/收入、OI；免费与 Pro 为不同服务 | 优先核验 DEX 份额、费用与 TVL。由数据源审计另行验证实际字段、日期和数据质量。无需为了这些免费端点安装付费 MCP |
| DefiLlama 官方 MCP | 官网明确需要 API plan、与 API key 共用 credits；官网 API 文档列 Pro 为 $300/月 | 可选升级项，第一版不建议；若未来大量自然语言分析需要统一协议查询，再由用户决定 |
| CoinGlass 官方 MCP Beta | 官网存在，需 CoinGlass API key；资金费率、OI、清算、交易所对比适配 CEX；工具定义处于 Beta 且受 API 额度限制 | 仅当免费方案不能满足 CEX 多平台衍生品历史时考虑；不作为默认免费源 |
| CoinGlass API | 报价页区分个人与商业套餐；页面商业 Standard 标为 $299/月（年付折算，页面有月/年选项） | 本项目公开、面向业务，不能用最低个人套餐预算代替商业权限；采购前重新核价与核用途 |
| CoinGecko Demo / 官方 MCP | 已有插件足够做当前取样；官方另有 keyless MCP 与 authenticated MCP。Demo 定价页列 10,000 calls/月、100 calls/min、需署名；Keyless 官方说明面向低量测试及非商业教育 | 不需为第一版新增同类插件。正式公开用途、历史端点及额度要单独确认；不能把 Demo 免费等同商用发布已许可 |
| CoinMarketCap Basic API | 当前主站定价页列免费 Basic、15,000 credits/月、50 requests/min，并明确商业使用；同时限制独立再分发，且描述终端用户为个人非商业用途 | 作为免费行情/CEX 候选，须核实本项目高管/营销业务使用与公开展示是否匹配。当前会话插件可调用不证明我们已拥有部署 key |

官方依据：[DefiLlama API](https://api-docs.defillama.com/)、[DefiLlama MCP](https://defillama.com/mcp)、[CoinGlass MCP](https://docs.coinglass.com/reference/mcp-service)、[CoinGlass 套餐](https://www.coinglass.com/pricing)、[CoinGecko 定价](https://www.coingecko.com/en/api/pricing)、[CoinGecko Keyless 说明](https://docs.coingecko.com/docs/keyless-public-api)、[CoinGecko AI 集成](https://docs.coingecko.com/docs/ai-agents-llm-apps)、[CMC 定价与用途说明](https://coinmarketcap.com/api/pricing/)。

### 免费公开使用的具体待核项

- CMC 主站定价页已经写明 Basic 商业使用，旧 `pro.coinmarketcap.com/features` 搜索摘要仍出现个人用途表述；且主站附带最终用户与再分发限制。应以签约/注册时实际有效条款与具体用途为准，不在 PRD 中写“CMC 免费商用完全确认”。
- CoinGecko 主站 Demo 的商用栏未明确赋权，官方商用许可说明列的是付费套餐；因此免费 Demo 数据可用于本次调研不等于公开业务网站可直接采用。[CoinGecko 许可说明](https://support.coingecko.com/hc/en-us/articles/16760512207257-What-Are-the-Differences-Between-Commercial-and-Custom-Licenses)
- GitHub 可以存项目代码和指标定义；供应商原始数据/大批历史数据是否能放公开仓库，是另一个发布范围问题。未核实许可前，项目设计应允许代码公开、数据不随代码仓库批量分发。

## 5. 插件与每天定时采集的关系

推荐把网站采集端设计为独立的 provider adapter：每个数据源记录 URL/接口、认证方式、调用预算、来源时间、抓取时间、单位、对象范围、使用条件和变更记录。

会话插件通常使用当前应用授权或插件服务的上下文。云端的 GitHub Actions / 定时任务需要独立网络环境、凭据及运行权限，不能复制会话 token，也不能假定插件工具名称在云端可直接执行。CoinGlass 官方也将 REST API 列为后端服务、自动脚本及生产系统的适用方式。[CoinGlass MCP 与 REST 说明](https://docs.coinglass.com/reference/mcp-service)

Longbridge 官方文档进一步区分 OpenAPI 启用、行情权限和账户要求；免费使用接口不代表所有行情免费，也不证明对外再发布已授权。其证券行情与代币化股票市场不可混为一谈。[Longbridge 开发者概览](https://open.longbridge.com/docs)、[行情权限说明](https://open.longbridge.cn/docs/quote/overview)

## 6. AI 解读建议

建议解读只引用本站已通过验证的数据，面向高管与营销回答“哪里变化最大、哪些交易所份额变化、观察到什么趋势、哪些数据尚缺”。每一条包含数据日期、相关指标链接；事实与推断分开，不自动生成交易建议或没有证据的因果关系。

实现选项需要用户确认：

| 方案 | 能否保证零新增模型账单 | 适用条件 |
|---|---|---|
| 固定规则生成“数据摘要” | 可以做到无外部模型调用费；不应标成 AI 生成 | 用户同意摘要命名/表现方式；规则仅描述已核验的数值变化 |
| 已有本地开放模型 | 未核实；模型许可、硬件、电力、常驻运行与质量均待验证 | 用户选择自托管，且接受机器需持续可用；本轮未下载模型 |
| 云端模型免费额度 | 不能在未选定服务、未核实条款/额度前保证长期免费 | 用户先选择或批准候选，注册、API key、数据处理条款和配额分别确认 |
| 付费模型 API | 不能 | 先给出模型、次数、每次 token 预算和月度上限，再由用户决策 |

在生成方案未确认时保留 AI 解读区域并标注“待接入”；不删除、不用假内容填充、不把模板冒充 AI。生产模型调用必须有结构化输入输出、可追溯的指标引用、缺失数据约束以及失败保留上一有效版本的策略。

## 7. 供 PRD / Spec 使用的判断

第一版实现比例应按“页面模块已完成”与“真实数据已接入”分开计算。已返回样本、已获得免费长期来源、已确认公开使用范围、已通过定时运行验证，不能合并为一个状态。

适合目前写入文档的表述：

> 现有插件验证了部分代币化股票与 HYPE 行情可获取；DEX 份额优先评估 DefiLlama 免费 REST；CEX 多平台历史和代币化股票全市场统计需按模块验收。公开展示许可与云端每日更新未因插件样本成功而自动通过。未接入内容保留为待接入/数据暂缺，未经用户确认不删改栏目或替换指标。

