# 页面覆盖与完整报告 PDF：独立审计 v2

审计日期：2026-09-15。只读检查现有代码、PRD/SPEC、原站范围审计及 `web/data/bootstrap.json`，未调用 Sites、未安装依赖、未改动 web 项目。主代理正在实施，以下是检查时点的差异与验收基线，不应把途中代码状态当最终结论。

## 结论

原站 HL/RH 的多处组合图、比例和筛选可用现有字段恢复，无需新 API。优先恢复这些已在批准范围内的组件。计算结果须继承原数据的过期、口径与来源状态；恢复图表不等于解决来源许可或生产资格。

PDF 应覆盖首页 + 12 专题路由、32 个专题 tab；32 是现有 tab 总数，不代表原站所有功能均已恢复。每一份报告必须使用同一已接受数据快照，默认选择、已覆盖维度、待接入状态和裁剪范围必须可核对。不要用浏览器当前可见页、当前 tab、表格第 1 页作为“完整报告”。

## 1. 已有数据可恢复的组件（优先级从高到低）

依据：`web/docs/PRD.md` 5 节及原有内页结构表；`docs/research/origin-data-audit.md` 第 4 节 RH/HL 组件表。不提出原站范围以外的新模块。

| 位置 | 原有组件 / 当前差异 | 现有字段与恢复方式 | 必须保留的边界 |
| --- | --- | --- | --- |
| HL 概览 | HIP-3 日成交柱 + OI 线 + 累计成交；当前单指标图/下拉不等于完整组合图 | `hl_hip3_overview.daily_volume/open_interest/cum_volume`；成交与 OI 可组合，累计单独切换或图 | `cum_volume` 是源历史累计，不能用截取的 180 日重新求和替代；OI 是时点存量，不能跨日相加 |
| HL 概览 | HIP-3 vs Crypto 成交额、OI 及各自份额 | `hl_hip3_and_crypto` 的 date×category；成交与 OI 分别求同日分母 | 两类齐备且有效才计算；不能把成交额分母用于 OI；日度历史不混官方滚动 24h 快照 |
| HL 按类别 | 全 HL 与 HIP-3 的成交额 / 份额切换、堆叠 | `hl_by_category`、`hl_hip3_by_category` 各自同日 category 分母 | 两个总体不同，分别计算；保留真实 0，缺分类/缺值不是 0；Top N 不能重新归一化为 100% |
| HL 按市场 | 部署市场成交与 OI、金额 / 份额切换 | `hl_hip3_by_market.daily_volume/open_interest`；date×market | 市场总和已与 HIP-3 对账，不能与类别表再次相加；累计与每日分开 |
| HL 费用 | Core / HIP-3 拆分、HyperEVM 链费 | `hl_volume_split.core_daily_volume_usd/hip3_daily_volume_usd/total_trading_volume_usd/hyperevm_fees_usd` | 成交拆分与链费分别呈现。该数据集与概览同日数值严重不同，绝不跨来源共用分母；fees/revenue/隐含 bps 仍待接入，不能用固定费率推算 |
| RH 链上概览 | 日交易 + 7 日均线；新增 / 回访钱包堆叠与比例 | `rh_daily_transactions.transactions` 连续 7 日算术均值；`rh_active_wallets.wallets` 按 wallet_type 分组 | 7 个自然日缺任何一天则 MA=null；首日 returning 缺行不能自行补 0；链身份 / SQL 原有待核提示保留 |
| RH DEX | 日成交额堆叠 / 比例；累计成交占比 | `rh_dex_volume.volume_usd` date×dex；同日全部原始类别分母，Top8+其余已知值可聚合 | 保留版本身份；含 1inch 路由与执行协议，去重未核，只能明确称来源记录构成，不能称全行业 / 已去重市场份额；有 null 或缺类别的日期不计算完整份额。历史只保留 50 天，累计必须写清“当前保留区间累计” |
| RH Meme Launchpad | 新币发行；成交额 / 笔数 / 活跃交易者；累计占比 | `tokens_launched` 与 `volume_usd/trades/wallets`；字段选择已有基础，但构成图/累计未完整恢复 | 该成交数据有 21 个 null、6 个 >10 亿美元异常候选。不得静默删除异常、把 null 当 0 或忽略后宣布完整分母。活跃钱包各 launchpad 单独去重，相加不代表链去重人数。当前 activity 仅 17 天 |
| RH RWA 币股 | 资产分类市值 / 成交金额与份额 | `rh_rwa_aum.aum_usd` date×asset_class；`rh_rwa_volume.volume_usd` date×series | AUM 是存量，不能按日相加作为累计；股票、ETF、商品、国债与 memecoin×stock pairs 身份保留；两套数据日期不同，不合成一个“今日” |
| HL 按资产 | Top N / 类别筛选；单资产成交 + OI 历史 | `hl_symbol_latest` 50 个资产含 category；`hl_symbol_series` 仅 5 个抽样 symbol | 最新榜单不是全资产历史。SPX/WTI 存在 date×symbol 重复且缺市场维度，不应按 volume/oi 绕过原 null 防线；目前可绘制唯一历史仅 XYZ100、SKHX、BRENTOIL。缺历史资产保留入口和提示 |
| HL HIP-4 | volume / trades / active_markets / yes-no volume | 现有 122 日字段均在；原始 network/window/bucket 保留 | yes+no 应与 volume 对账；源 volume 币种尚未核，不改标 USD；截至 9/1 提示仍需可见 |
| HL HyperEVM DEX | 分 DEX 成交、交易笔数、交易地址数 | 现有 volume_usd/trades/unique_traders 可切换 | 地址为各 DEX 分别去重，不能以加总值标“全链去重用户” |

### 已完成的本地数值证据（固定 bootstrap，非当前市场事实）

- `hl_hip3_by_category` 日成交总和、`hl_hip3_by_market` 日成交/OI 总和与 `hl_hip3_overview`，在全部 142 个共同日期的相对误差 < 1e-9。
- `hl_by_category` 日成交总和与 `hl_hip3_and_crypto` 的 Crypto+HIP-3 总和，在全部 142 个共同日期对账通过。
- 2026-09-11 HIP-3 成交额 2,474,912,683.2924285；Crypto+HIP-3 总成交额 11,322,270,620.814571；HIP-3 份额 **21.85880170%**。OI 为 4,027,701,505.0679445 / 14,326,842,420.265968，份额 **28.11297414%**。
- 2026-09-11 Stocks 占 HIP-3 成交 **45.92110703%**；占全 HL 成交 **10.03780372%**。这两个数不同是正确口径，不应共用分母。
- 2026-09-10 `hl_volume_split` 的 Core+HIP-3=1,252,595,968.8389153，与其 total 完全一致；Core 68.59452943%、HIP-3 31.40547057%。但概览来源同日总成交为 8,947,745,874.970596，split 仅为其约 **13.9990%**。此冲突须保持原有口径待核，不拿一个来源修补另一个。
- HIP-3 180 日保留成交额求和 472,506,814,613.1887；最后源累计值 577,778,229,731.9421。二者差异来自覆盖，不能替代。相邻日 `cum_volume` 增量与当日成交对账通过（最大相对误差约 2.57e-13）。
- RH 日交易最后 7 个连续日期截至 2026-09-12，MA7=**9,062,485.285714285**；当日交易 8,540,815。
- RH 2026-09-10 新增/回访钱包合计 148,115；比例 **42.61486007% / 57.38513993%**。
- RH `launchpad_activity` 总 1,000 行中有 21 个 null 成交额；9/12 的 55 行也有 1 个 null。仅 8/28、9/1 没有显式 null，并不自动证明其他缺行是真实 0。`rh_dex_volume` 有 5 个 null 历史行，部分日期只有 19 个类别而非 20。严禁对这些日期静默忽略 null 后归一化。

## 2. 其他不能以路由齐全掩盖的范围差异

主代理正在补 CEX 日/月份额、同平台合约/现货比、储备份额，本审计不重复实施。

1. 交易所对比原有综合表包含现货/合约/储备及 TradFi 成交/OI，且有相应份额与跨所对比。当前 3 个排名面板不等于原完整综合表。已有 `tradfi_exchange_comparison`、股票成交/OI 数据可复用；缺的指数溢价/焦点标的关联部分保留待核，不猜连接键或混日期。
2. CEX 储备原有“储备可信度”是独立视图，当前评分占位嵌在资产 tab。报告必须明确该保留内容，而不能因保持“32 tabs”计数就漏掉原有评分方法/明细的待接入范围。是否拆成新 tab 由主代理按既定 UI 方案处理，不以审计自行变更页数分母。
3. 资金费率原有交易对与聚合两套 Z-score、多窗口。一个笼统 Z-score 占位不能宣称两套均可用。聚合成交原有币种/标签、1h/4h/1d；当前 BTC 日度可用，其余保持明确缺口，不用 30/90/180 天图窗替代采样频率。
4. 热门板块实际只 Stocks 有分析数据；28 个目录项已保留，其余 27 项待接入。28 分类目录 ≠ 28 分类都完成。同一 sector 在 3 个 tabs 目前会复用同一占位，报告宜给出一张 28×3 覆盖矩阵并保留各模块状态，避免重复生成 81 张相同空白页。
5. 图表 `Area` 当前无 `stackId`，多系列为重叠曲线，并非原有堆叠金额/份额图。排名条宽度是相对第一名的大小，不能被文案当真实份额。

## 3. 完整日 / 月与时间窗必须统一验证

检查时点 `lib/data.ts.latestRows()` 取最大 date；`series()` 取保留日期末日后回看窗口，没有排除未完成当天。`scripts/fetch_decentralized.py.bound_rows()` 仅确保截取整组日期，**不证明该自然日已完成或来源已报齐**。`scripts/fetch_cex.py.add()` 对 month 无条件把 asOf 改成当月月底，并写 completed month-end；源一旦返回当月累计，会被错误标完整月。

建议作为统一读模型的约束：

- 区分 `day`、`month`、`current snapshot`、`rolling24h`。仅日/月数据应用已结束期筛选；官方即时上下文保留精确采集时间与滚动窗口，不因日期为今日删除。
- 日线默认截至上游口径下最近已结束并满足数据完整性的日期；UTC 截止只是必要条件，还要数据发布/缺报校验。未证明发布完整的指标写“截至日期 / 来源口径待核”，不要直接认证为完整。
- 月度采用 periodStart/periodEnd；未结束月份标 MTD 或从默认完整月视图排除，不把未来月末写成已观测 asOf。
- 同一比例的分子、分母、去重集合、单位、日期一致；多个来源的关联比较取共同有效时间点，不让两侧各取自己的 latest。
- 每个 panel 单独展示数据截至；报告生成/采集时间与数据日期分开。同快照不要求所有来源同一天，过期数据保留相应状态。
- 缺日的 7/30 日量、MA7、比较期差值留空，不把 6 个观测点称 7 日；自然日窗口与“最近 N 条”分别命名。历史裁剪的开始日期必须可见。

## 4. PDF 固定覆盖清单（13 routes / 32 专题 tabs）

| route | 必须包含的 tab / 视图 | 数量 |
| --- | --- | ---: |
| `/` | 总览 KPI、六个摘要 panel、原有 AI 解读与来源/覆盖状态 | 首页 |
| `/cex/compare` | 综合对比 | 1 |
| `/cex/volume` | 每日成交量、每月成交量 | 2 |
| `/cex/reserves` | 储备资产（包括保留的可信度范围） | 1 |
| `/cex/open-interest` | 聚合持仓、单交易对、保证金历史 | 3 |
| `/cex/funding` | 单交易对、加权费率、资金费率套利、Z-score | 4 |
| `/cex/aggregated-volume` | BTC、其他资产 | 2 |
| `/dex/market-share` | 现货 DEX、永续 DEX | 2 |
| `/dex/robinhood-chain` | 链上概览、DEX、Meme Launchpad、RWA 币股 | 4 |
| `/tokenized-stocks/sectors` | 板块概览、交易所对比、资金费率；Stocks 数据和全 28 类覆盖清单 | 3 |
| `/tokenized-stocks/arbitrage` | 价格对照 | 1 |
| `/tokenized-stocks/stablecoins` | 按币种、按链 | 2 |
| `/hyperliquid` | 概览、费用、按类别、按市场、按资产、HIP4、HyperEVM DEX | 7 |

不要把所有历史日期×实体×字段×图窗的笛卡尔积都输出为独立图。静态报告应有明确默认窗口、同一面板的指标/份额状态和完整维度表；源数据明细放独立附录或既定附件方式。若采用附录，dataset 可只收录一次，再由各章节引用，避免重复 panel 把同一 180 日数据反复印出。

重要数据规模：bootstrap 49 datasets、13,679 行。`tradfi_arbitrage` 为 77 行、63 列；`funding_arbitrage` 200×14；HL 官方市场快照 200×21、部署市场总量 11×15；稳定币180×28。63 列不能缩到一张纸或依赖横向滚动区域截屏。

## 5. PDF 验收用例

### A. 范围和维度

- **A01 覆盖 manifest**：每个 route/tab 的稳定 ID、panel、dataset、measure、entity/category 范围、默认窗口都进 manifest。核对 13 routes、32 专题 tabs，保留 pending/review/stale；源新增条目不自动增加批准范围。新增恢复组件要纳入同一 manifest。
- **A02 不受浏览状态影响**：先在普通网站选择第 2 页表格、某交易所、30 天、非 Stocks，再导出；完整报告仍包含约定全范围，且封面标明固定默认状态，不偷偷继承局部过滤。
- **A03 稳定币两视图**：币种只用 `all_*` 族、链只用链字段；两者是不同维度，不相加为全行业规模；`all_stablecoins` 为总计不重复加总。不能因读取当前外层 tab 状态导致两页内容相同。
- **A04 全 28 sector 状态**：Stocks 的三 tab 数据完整；其余 27 类在目录/覆盖矩阵逐一出现并标待接入。不得伪造数据、静默丢掉分类或重复以空白页充当实现。
- **A05 实体完整性**：默认 Top N 图保留名称与剩余构成说明；完整已覆盖实体列表可追溯。HL 最新 50 资产、历史 5 抽样/3 可绘制、官方 200/519 覆盖分别记录；200 行明细不能宣称全平台资产。

### B. 数字与时间

- **B01 独立计算**：用固定 bootstrap 运行纯计算断言，核对本报告中的 HL/RH golden values；未格式化值相对容差 1e-9（近 0 另设小绝对容差）。展示文本按指定格式核对，不对已四舍五入文本强求百分比精确总和 100.00。
- **B02 份额坏数据**：注入 null、负值、重复 date/entity、缺实体、0 分母；预期缺口/待核，不得 Infinity/NaN/强归一化。Top N + 其他的总和须来自全有效分母；只隐藏系列不改变分母。
- **B03 单位和别名**：`value` 与 `volume_usd/daily_volume` 是同一指标别名，不可相加。费率小数/%/source-rate 按现有状态；OI 当前值不按日累计；HL 官方 `oi_native × mark_price` 的报价币名义值不自动换 USD。
- **B04 完整日**：构造 UTC 00:01 的同批次昨日和今日记录；日图/份额默认用已完成有效日，当前滚动 24h 官方快照仍可显示且明确命名。来源在前一日尚缺报则进一步回退或标 partial；采集成功不得掩盖数据过期。
- **B05 完整月**：源新增当月累计时不能标未来月末 asOf 或完整月；上一完整月仍正确。日/月对账只用共同完整覆盖，不拿截取180日去证明45月累计。
- **B06 缺日和累计**：7 个连续自然日平均正确；缺一天则 MA7 空。HIP-3 使用源 cum_volume；RH 当前保留区间求和明确 start/end，不称历史累计。跨期比较缺值留空。
- **B07 HTML/PDF 同数**：对选定 panel 的 latest、图最后点、排名/份额、明细数值逐项核对同一底层数据和格式化结果；不得出现首页 KPI 是一组 latest、PDF 图是另一组 latest。`asOf`、source URL、状态一起检查。

### C. 长表、图表和视觉

- **C01 分页行完整**：取消普通 DataTable 的每页10行限制；对约定明细 scope 核对导出 rowCount 与输入 manifest，第一行、跨页边界、最后一行均存在，无重复和遗漏。正文若是摘要，必须标摘要范围并准确指向完整明细。
- **C02 63 列拆分**：价格对照按参考标的块与交易所列组拆分，每组重复 entity、sector、referenceSymbol（必要时参考价格/时间）。每家保留价格、溢价、源费率、合约、报价时间；用字段清单验证 63 个原列均被覆盖，不能只输出首屏 8 列。缺字段继续为“—”。
- **C03 HL 长表分组**：200×21 按价格/OI/成交/费率和市场元数据拆组，重复 dex+coin 键与 observed_at；报价币、delisted、采集错误/覆盖不得消失。禁止以 entity 裸 symbol 作为跨部署市场唯一键。
- **C04 表头 / 可读性**：跨页重复表头、足够字号、数字单位明确；长交易对和来源 URL 换行而非盖住邻列；图表整体分页，不能被截成上下两半；检查无 overflow 裁切、水平滚动残留、空白尾页和孤立标题。
- **C05 渲染就绪**：页面明确 reportReady 后再生成，等待字体与真实图表尺寸，不只等 networkidle；检查图表非零面积和SVG内容。重复 dataset 的多个图使用不同 SVG gradient IDs，避免整份报告渲染时 ID 冲突。颜色/图例/坐标在 PDF 中清晰，百分比图 y轴口径正确。
- **C06 输出抽检**：程序提取 PDF 文本验证全部章节标题、待接入理由、关键数值、最后页存在；渲染封面、各业务组、最宽表、最长表、缺数据页、末页作视觉 QA。PDF metadata、文件名、封面日期一致；正文中文可搜索/复制。

### D. 同快照与每日产物

- **D01 固定快照**：所有章节从同一个不可变 bundle 读取，manifest/封面保存 snapshotId + content hash + generatedAt（数据截至另列）。不按13个页面反复请求 latest。并发日更期间 PDF 不可混合两个版本。
- **D02 服务器接受版本**：当前 ingest 的 keepLastGood 可能把候选数据与旧有效行合并。PDF 必须使用服务器最终接受的 canonical snapshot；不能 collect 候选 JSON 直接生成后却与线上合并快照声称一致。发布回执/按版本读取必须能锁定准确 bytes 或 canonical hash。
- **D03 原子指针**：先完成快照校验、报告渲染和质量校验，再更新“最新报告”指针。网站下载按钮指向已经存在、与标注快照匹配的文件；不得在生成前就发布新的下载 URL。
- **D04 失败降级**：采集/渲染/上传任一步失败时保留上一份可下载 PDF，展示其真实日期；不生成空白报告、不将旧报告重标今日。浏览器打印降级仍明确打开保存对话框，不能对外宣称直接生成文件成功。
- **D05 公共访问**：私有 GitHub 仓库的 Actions artifact 不能直接作为公众一键下载。匿名窗口验证下载状态、Content-Type、Content-Disposition、实际 PDF 头与文件大小。既定存储/交付方式按用户批准实施，不添加未经批准的付费服务。
- **D06 可重复性**：同一 bundle 与固定 report-config/version 重跑，数据 manifest 与内容检查一致；不要求含自动生成时间的 PDF 原始字节完全相同。一次源失败/一次人工触发成功不等于证明连续每日稳定性，应保留实际执行记录。

## 6. 实施时容易踩到的代码点

- `web/lib/data.ts`：`latestRows` / `rank` / `series` 各自 latest 逻辑；`shareDataset` 初版适用于 CEX 宽表，不可直接拿 RH/HL 长表套用（长表要按 date 分组、指定 primary measure、去别名、验齐实体）。
- `web/components/dashboard.tsx`：`DataTable` 的10行分页；`Chart` Top5/不堆叠/gradient id；外层 tab 对 stablecoin 数据维度的隐式绑定；sector 替换占位；关闭的 source details；排名相对最大值条形。
- `web/scripts/fetch_cex.py`：月末 asOf 转换与1,000行截取；`fetch_decentralized.py`：整日期裁剪与完整日概念不能混淆。
- `web/app/api/data/route.ts`：检查时点只读取 current_snapshot，返回 generatedAt 和 datasets，未提供固定版本读取；`web/scripts/publish.py` 只校验 accepted 回执。D01/D02 需要主代理补齐后验收。

本报告未更改任何产品内容；所有数值对账来自固定本地 bootstrap，仅作为实现与回归测试证据。
