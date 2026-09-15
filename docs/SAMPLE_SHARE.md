# 永续 DEX 样本份额口径

固定样本版本：`hl-core-hip3_dydx-v4_lighter-eth-v1`。用户于2026-09-15确认采用已接入协议样本内份额。

分母为 Hyperliquid（Core + HIP-3）、dYdX v4、Lighter Ethereum主网永续三个完整协议样本的官方滚动24小时成交名义额之和；份额=协议成交名义额/分母×100。不代表全球DEX市场份额，不为未覆盖协议造“其他”。

官方接口返回的统计终点不完全同步。保留逐请求开始/完成时间和HTTP Date（HTTP时间不作为市场观察时间），同批采样跨度上限5分钟。09:00版本只允许截止前采得的数据。使用协议原生美元或锚定美元报价名义值，未作稳定币汇率重估；不同协议成交定义差异仍需在分析时考虑。

|协议|直接来源|字段与完整性|
|---|---|---|
|Hyperliquid|https://api.hyperliquid.xyz/info|先perpDexs，逐命名空间metaAndAssetCtxs；universe/context逐一匹配；求和dayNtlVlm；Core与所有HIP-3必须成功|
|dYdX v4|https://indexer.dydx.trade/v4/perpetualMarkets|全量markets的volume24H；包含来源返回的所有状态；官方统计不含清算/去杠杆成交|
|Lighter|https://mainnet.zklighter.elliot.ai/api/v1/orderBookDetails|只用order_book_details中的perp与daily_quote_token_volume；与orderBooks的perp ID集合核对；不计现货|

任一协议失败、关键字段缺失、重复市场、负值或非有限值、分母为0时不计算本批份额，保留上一完整样本并标记失败。保留最近180个香港日期的完整采样记录，同一天以后一次成功采样为准。改变协议集合需要新版本，不把不同集合的变化解释为竞争份额变化。

Aster现有接口部分市场返回超过24小时的统计窗口或很旧的closeTime，故暂不纳入分母。保留候选原因，后续验证统一窗口后再申请扩展集合。现货DEX仍独立待接入，不用永续或单链样本替代。
