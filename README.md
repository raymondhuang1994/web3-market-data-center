> 当前每日发布合同已更新：见 [DAILY_EDITION.md](docs/DAILY_EDITION.md)。每日含周末，香港时间09:00截止、目标10:00前完整发布，Codex解读与PDF绑定同一数据快照。下方旧时间表保留为历史记录。

> v0.2：新增逐项数据核验 `/sources`、整站报告 `/report` 与每日 PDF 下载。实现细节与剩余缺口见 [docs/RELEASE_V2.md](docs/RELEASE_V2.md)。

# Web3 市场数据中心

面向高管与营销团队的中文市场看板。覆盖 CEX、DEX、代币化股票及 Hyperliquid；以真实来源快照作图，明确区分已接入、源数据延迟、口径待核和待接入。

网站：https://web3-market-center.raymondhuangj.chatgpt.site

源码保存在此私有仓库；网站按用户要求公开。代码与数据的授权分别处理，本项目不为上游数据授予新许可。

## 功能

- 总览与 12 个专题路径，CEX 6 页、DEX 2 页、代币化股票 3 页、Hyperliquid 7 个内部标签。
- 图表、标的/指标筛选、30/90/180 日及全部已采集时间范围、最新排名、明细搜索/排序/分页。
- 每图显示来源、数据日期、采集时间与限制；空值不按零绘图，重复维度形成断点。
- Robinhood Chain 四个标签、热门板块 28 类目录完整保留。
- CEX 网站流量/期权和 UNI Burn 已按要求排除；DEX 现货与永续市场份额保留待接入。
- AI 解读由现有 Codex 订阅按日生成，事实数字由程序复算；未购买模型 API、数据 API 或安装新数据插件。
- 逐项数据核验记录实际采集时间、来源日期、粒度、单位和可靠性；整站 PDF 覆盖 32 个子标签，并附 7 张关键明细表全部已采集记录。

## 本地运行

Node.js >=22.13，pnpm 11.19。Python >=3.10 用于采集（无第三方 Python 包）。

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

使用 Sites 的 vinext / React / Recharts / shadcn UI，D1 负责生产快照和报告元数据，R2 保存 PDF 与快照归档。`.openai/hosting.json` 只含非敏感逻辑绑定，真实资源由 Sites 配置。

## 每日更新

GitHub Actions 每日香港时间08:37、08:52提前采集，09:00截止；Codex于09:10生成解读、09:35补查，目标10:00前发布。周末与香港假期照常生成。公开数据源可能延迟，保留真实数据日期。调度及本地Codex依赖见[每日发布合同](docs/DAILY_EDITION.md)。

1. 两个标准库采集器请求批准来源，不执行付费查询或交易操作。
2. `collect.py` 输出临时候选快照（不提交 raw 响应，不将受限费用并入候选）。
3. `publish.py` 获取短期 GitHub OIDC 身份，audience 绑定上传正文 SHA-256，不需要长期共享 secret。
4. 网站验证仓库/owner ID、分支、工作流、事件、签名、有效期、数据契约和来源白名单。
5. D1先暂存截止前的有效数据，Codex解读通过引用与事实哈希核验后冻结；失败保留上一完整版本。最近60批保留在D1，更旧数据仅在已归档后清理。
6. Playwright使用固定快照及解读生成整站PDF，上传完成后通过D1事务一起发布数据、解读和PDF。下载链接绑定正在查看的版本；超过10点仍未完成时显示延迟。

私有 Actions 及 Sites 的可用额度由账户控制；没有购买付费计划。不承诺超出既有免费额度运行。工作流失败在 GitHub Actions 可见，网站仍提供上一有效快照。

## 数据边界

初始 49 个数据集均保留。已取得历史主要为日频最多 180 日，月成交额约 45 月；官方 Hyperliquid 是逐市场采样的当前快照。Stocks 之外 27 类只有已验证目录，未声称全部历史已经接入。

原站聚合资料采用来源署名。原站的 API 可读不代表获得上游供应商再分发授权；明确限制公开使用的 DefiLlama 费用与市场份额未发布数值。各来源条件仍需持续核对，见 [数据审计](docs/DATA_SOURCES.md)。

费率原值暂不作未经核实的百分比换算；不同保证金 OI 不混加。Hyperliquid USDC/USDE/USDH/USDT0 报价币名义值未进行汇率换算。CEX 源样本含部分 DEX，样本合计不代表全球 CEX；股票主题永续不等于可兑付实股的代币。

## 文档与维护

- [PRD](docs/PRD.md) / [SPEC](docs/SPEC.md)
- [实施说明](docs/IMPLEMENTATION.md)
- [来源与可获取颗粒度](docs/DATA_SOURCES.md)
- 数据采集脚本位于 `scripts/`；归一化契约在 `lib/snapshot.ts`。
- D1 迁移以 Drizzle 生成；已部署迁移不得改写，新增 schema 时追加迁移。
- 本地 `work/`、原始响应、密钥与依赖目录不进入版本库。
