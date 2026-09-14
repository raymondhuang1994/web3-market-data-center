#!/usr/bin/env python3
"""Read-only research collector. Standard library only; no keys or paid endpoints.

Original-site data remains licence/definition review or stale. DefiLlama-derived
fees are saved under restricted/ and omitted from datasets.json. No website,
GitHub, account, wallet, or deployment mutations are performed.
Usage: python3 fetch_decentralized.py --out /private/tmp/web3-decentralized-assets
       python3 fetch_decentralized.py --out ... --offline
"""
from __future__ import annotations
import argparse
import concurrent.futures
import datetime as dt
import hashlib
import json
import math
import pathlib
import re
import time
import urllib.parse
import urllib.request

ATTEMPTS = {}
UTC = dt.timezone.utc
ORIGIN = "https://data.wublock123.com"
HL = "https://api.hyperliquid.xyz/info"
LICENSE_NOTE = "原站公开缓存可读取；原站/查询作者适用于本网站的再发布授权和查询SQL口径尚未核实。"
SPECS = [
 ("rh_daily_transactions", "Robinhood Chain 日交易", "/api/robinhood-chain/daily_transactions", "transactions", "count", None),
 ("rh_active_wallets", "Robinhood Chain 活跃地址", "/api/robinhood-chain/active_wallets", "wallets", "addresses", "wallet_type"),
 ("rh_dex_volume", "Robinhood Chain DEX 成交量", "/api/robinhood-chain/dex_volume", "volume_usd", "USD", "dex"),
 ("rh_launchpad_new_tokens", "Meme Launchpad 新发代币", "/api/robinhood-chain/launchpad_new_tokens", "tokens_launched", "tokens", "launchpad"),
 ("rh_launchpad_activity", "Meme Launchpad 活动", "/api/robinhood-chain/launchpad_activity", "volume_usd", "USD", "launchpad"),
 ("rh_rwa_aum", "Robinhood Chain RWA 市值", "/api/robinhood-chain/rwa_aum", "aum_usd", "USD", "asset_class"),
 ("rh_rwa_volume", "Robinhood Chain RWA 成交", "/api/robinhood-chain/rwa_volume", "volume_usd", "USD", "series"),
 ("hl_hip3_overview", "HIP-3 概览", "/api/hyperliquid/hip3_overview", "daily_volume", "USD (来源页面口径)", None),
 ("hl_hip3_and_crypto", "HIP-3 与 Crypto", "/api/hyperliquid/hip3_and_crypto", "daily_volume", "USD (来源页面口径)", "category"),
 ("hl_fees_daily", "Hyperliquid 费用", "/api/hyperliquid/hl_fees_daily", "fees_usd", "USD", None),
 ("hl_volume_split", "Core / HIP-3 成交与 HyperEVM 费用", "/api/hyperliquid/hl_volume_split", "total_trading_volume_usd", "USD", None),
 ("hl_hip3_by_category", "HIP-3 按类别", "/api/hyperliquid/hip3_by_category", "daily_volume", "USD (来源页面口径)", "category"),
 ("hl_by_category", "Hyperliquid 按类别", "/api/hyperliquid/hl_by_category", "daily_volume", "USD (来源页面口径)", "category"),
 ("hl_hip3_by_market", "HIP-3 按市场", "/api/hyperliquid/hip3_by_market", "daily_volume", "USD (来源页面口径)", "market"),
 ("hl_symbol_latest", "HIP-3 按资产最新日 Top 50", "/api/hyperliquid/symbol?view=latestTop&n=50", "volume", "USD (来源页面口径)", "symbol"),
 ("hl_hip4", "HIP-4", "/api/hyperliquid/hip4", "volume", "source native; USD待核", None),
 ("hl_hyperevm_dex", "HyperEVM DEX", "/api/hyperliquid/hyperevm_dex", "volume_usd", "USD", "project"),
]
DATE_KEYS = ("date", "day", "time", "block_date", "bucket_start_utc")
NON_MEASURES = {"date", "day", "time", "block_date", "bucket_start_utc", "bucket_ms"}


def now():
    return dt.datetime.now(UTC).isoformat().replace("+00:00", "Z")


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def slug(key):
    return re.sub(r"[^a-z0-9]+", "_", str(key).lower()).strip("_")


def date_of(value):
    if value is None:
        return None
    if isinstance(value, (int, float)) and value > 1e9:
        return dt.datetime.fromtimestamp(value / (1000 if value > 1e12 else 1), UTC).date().isoformat()
    s = str(value)
    return s[:10] if re.match(r"^\d{4}-\d{2}-\d{2}", s) else None


def number(value):
    if isinstance(value, bool):
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def fetch(root, key, url, body=None, offline=False, restricted=False):
    ATTEMPTS[url] = now()
    file = root / ("restricted" if restricted else "raw") / (key + ".json")
    meta_file = file.with_suffix(".meta.json")
    error = None
    if not offline:
        for attempt in range(2):
            try:
                data = json.dumps(body).encode() if body is not None else None
                req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json", "User-Agent": "Web3DataResearch/0.1"})
                with urllib.request.urlopen(req, timeout=35) as response:
                    payload = json.load(response)
                if isinstance(payload, dict) and str(payload.get("code", "0")) not in ("0", "200"):
                    raise ValueError("source error: " + str(payload.get("msg", payload.get("code"))))
                fetched = now()
                write_json(file, payload)
                write_json(meta_file, {"url": url, "request": body, "fetchedAt": fetched})
                return payload, fetched, None
            except Exception as exc:
                error = f"{type(exc).__name__}: {exc}"
                if attempt == 0:
                    time.sleep(1)
    if file.exists():
        payload = json.loads(file.read_text())
        fetched = json.loads(meta_file.read_text()).get("fetchedAt") if meta_file.exists() else dt.datetime.fromtimestamp(file.stat().st_mtime, UTC).isoformat().replace("+00:00", "Z")
        return payload, fetched, error
    return None, now(), error or "No cached response"


def placeholder(identifier, title, url, note, unit="USD", source_name="待接入"):
    return {"id": identifier, "title": title, "source": {"name": source_name, "url": url},
            "fetchedAt": now(), "asOf": None, "grain": "day × entity", "unit": unit,
            "dimensions": ["date", "entity"], "measures": ["value"], "rows": [],
            "status": "pending", "note": note,
            "coverage": {"rowCount": 0, "productionEligible": False}}


def bound_rows(rows, days=180, max_rows=1000):
    # Retain complete dates. Never silently cut half a daily market denominator.
    dates = sorted({r.get("date") for r in rows if r.get("date")})
    if not dates:
        return rows[:200], len(rows) > 200
    cutoff = (dt.date.fromisoformat(dates[-1]) - dt.timedelta(days=days - 1)).isoformat()
    keep = [r for r in rows if r.get("date", "") >= cutoff]
    by_date = {}
    for row in keep:
        by_date.setdefault(row["date"], []).append(row)
    chosen = []
    for day in sorted(by_date, reverse=True):
        if len(chosen) + len(by_date[day]) > max_rows:
            break
        chosen.extend(by_date[day])
    chosen.sort(key=lambda r: (r.get("date", ""), str(r.get("entity", ""))))
    return chosen, len(chosen) < len(rows)


def origin_dataset(spec, payload, fetched, error):
    identifier, title, path, primary, unit, entity_key = spec
    if identifier == "hl_fees_daily":
        return placeholder(identifier, title, ORIGIN + path,
            "原站响应明确 source=defillama。已取得的研究原始响应只存 restricted/；DefiLlama 条款限制未经许可再发布，公开 bundle 不含费用数值。保留费用 tab 待许可或其他适用来源。", unit, "原站转引 DefiLlama（受限）")
    if not payload:
        return placeholder(identifier, title, ORIGIN + path, "未取得有效响应：" + str(error), unit)
    raw = payload.get("data", [])
    envelope_date = raw.get("date") if isinstance(raw, dict) else None
    raw = raw.get("rows", []) if isinstance(raw, dict) else raw
    if not isinstance(raw, list):
        return placeholder(identifier, title, ORIGIN + path, "响应结构不匹配，保留位置等待核验。", unit)
    rows, all_keys = [], set()
    for original in raw:
        if not isinstance(original, dict):
            continue
        row = {slug(k): v for k, v in original.items() if not isinstance(v, (dict, list))}
        for k, v in list(row.items()):
            if isinstance(v, float) and not math.isfinite(v):
                row[k] = None
        day = next((date_of(row.get(k)) for k in DATE_KEYS if date_of(row.get(k))), None) or date_of(envelope_date)
        if day:
            row["date"] = day
        row["entity"] = str(row.get(entity_key) or title) if entity_key else title
        row["value"] = number(row.get(primary))
        all_keys.update(row)
        rows.append(row)
    original_dates = sorted({r["date"] for r in rows if r.get("date")})
    original_entities = {r["entity"] for r in rows}
    rows, truncated = bound_rows(rows)
    dates = sorted({r["date"] for r in rows if r.get("date")})
    asof = dates[-1] if dates else None
    lag = (dt.datetime.now(UTC).date() - dt.date.fromisoformat(asof)).days if asof else None
    status = "stale" if lag is not None and lag > 1 else "review"
    measures = ["value"] + sorted(k for k in all_keys if k != "value" and k not in NON_MEASURES and any(number(r.get(k)) is not None for r in rows))
    dimensions = ["date", "entity"] + sorted(k for k in all_keys if k not in measures and k not in {"date", "entity"} and k not in NON_MEASURES)
    notes = [LICENSE_NOTE]
    if lag is not None and lag > 1:
        notes.append(f"数据日落后当前UTC日期 {lag} 天；缓存更新/本次采集时间不代表数据更新。")
    if truncated:
        notes.append("仅保留最新180天且最多1000行，按完整日期截取；实际显示覆盖见coverage。")
    if identifier == "rh_dex_volume":
        notes.append("Robinhood专题所收录链内数据；含协议版本与1inch等名称，底层/路由量去重及网络身份待核，不作全市场DEX份额。")
    if identifier == "rh_launchpad_activity":
        anomalies = sum(1 for r in rows if (number(r.get("volume_usd")) or 0) > 1e9)
        notes.append(f"保留原始值；单行成交额>10亿美元的异常候选 {anomalies} 行，没有照搬原站阈值删除数据。")
    if identifier.startswith("rh_"):
        notes.append("链与网络身份依原站标题，须对照Dune SQL验收；不把专题归类当已验证链归属。")
    if identifier == "hl_hyperevm_dex":
        notes.append(payload.get("traders_note", "各DEX分别去重，跨DEX相加不能称全链去重地址。"))
    if identifier == "hl_volume_split":
        notes.append("data为日历史；响应独立rolling_24h快照未拼进日历史。隐含固定费率推算列按源说明已移除，不用于真实手续费。")
    if identifier == "hl_hip4":
        notes.append("Volume的原始响应未给币种；USD口径及Network含义待核验。")
    if identifier == "hl_symbol_latest":
        notes.append("来源symbol/coin可能为显示标签，未可靠提供部署dex命名空间，不与官方dex:coin自动等同。")
    if error:
        notes.append("本次刷新失败，保留上次响应：" + error)
    source = {"name": "原站公开缓存 / Dune", "url": ORIGIN + path, "upstreamUrl": payload.get("source_url"),
              "licenseStatus": "unverified", "queryId": payload.get("query_id")}
    return {"id": identifier, "title": title, "source": source, "fetchedAt": fetched,
            "asOf": asof, "grain": "day × " + (entity_key or "metric"), "unit": unit,
            "dimensions": dimensions, "measures": measures, "rows": rows,
            "status": status, "note": " ".join(notes),
            "coverage": {"rawRowCount": len(raw), "rowCount": len(rows), "rawEntityCount": len(original_entities),
                         "entityCount": len({r["entity"] for r in rows}), "rawFrom": original_dates[0] if original_dates else None,
                         "rawTo": original_dates[-1] if original_dates else None, "from": dates[0] if dates else None,
                         "to": asof, "truncated": truncated, "maxRows": 1000, "maxDays": 180,
                         "sourceUpdatedAt": payload.get("updated_at"), "sourceExecutionEndedAt": payload.get("execution_ended_at"),
                         "refreshError": error, "productionEligible": False, "primaryMeasure": primary}}


def official_datasets(root, offline):
    dex_data, enum_time, enum_error = fetch(root, "hl_official_perp_dexs", HL, {"type": "perpDexs"}, offline)
    if not isinstance(dex_data, list):
        reason = "官方perpDexs枚举未成功；不把默认市场冒充全平台。" + str(enum_error)
        return [placeholder("hl_markets_snapshot", "Hyperliquid 官方市场快照", HL, reason),
                placeholder("hl_dex_totals_snapshot", "Hyperliquid 官方DEX汇总", HL, reason)]
    dex_names = ["" if d is None else d.get("name") for d in dex_data]
    dex_names = list(dict.fromkeys(d for d in dex_names if d is not None))
    spot_meta, _, spot_error = fetch(root, "hl_official_spot_meta", HL, {"type": "spotMeta"}, offline)
    token_names = {t.get("index"): t.get("name") for t in spot_meta.get("tokens", [])} if isinstance(spot_meta, dict) else {}
    def one(dex):
        return dex, fetch(root, "hl_official_context_" + (slug(dex) or "core"), HL, {"type": "metaAndAssetCtxs", "dex": dex}, offline)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(one, dex_names))
    rows, totals, failed, refresh_errors, fetched_times = [], [], [], [], []
    for dex, (payload, fetched, error) in responses:
        if not isinstance(payload, list) or len(payload) < 2 or not isinstance(payload[0], dict) or not isinstance(payload[1], list):
            failed.append({"dex": dex, "reason": error or "invalid shape"})
            continue
        universe, contexts = payload[0].get("universe", []), payload[1]
        if len(universe) != len(contexts):
            failed.append({"dex": dex, "reason": "universe/context length mismatch"})
            continue
        fetched_times.append(fetched)
        if error:
            refresh_errors.append({"dex": dex, "reason": error, "cachedFetchedAt": fetched})
        group = []
        for meta, ctx in zip(universe, contexts):
            coin = meta.get("name")
            if not coin:
                continue
            mark, native_oi = number(ctx.get("markPx")), number(ctx.get("openInterest"))
            oi = native_oi * mark if native_oi is not None and mark is not None else None
            volume = number(ctx.get("dayNtlVlm"))
            row = {"date": fetched[:10], "entity": coin, "dex": dex or "core", "coin": coin,
                   "value": volume, "volume_24h_usd": volume, "oi_usd_mark": oi,
                   "oi_native": native_oi, "mark_price": mark, "oracle_price": number(ctx.get("oraclePx")),
                   "mid_price": number(ctx.get("midPx")), "previous_day_price": number(ctx.get("prevDayPx")),
                   "funding_hourly": number(ctx.get("funding")), "volume_24h_native": number(ctx.get("dayBaseVlm")),
                   "max_leverage": meta.get("maxLeverage"), "is_delisted": meta.get("isDelisted", False),
                   "collateral_token": payload[0].get("collateralToken"),
                   "quote_symbol": token_names.get(payload[0].get("collateralToken"), "unknown"),
                   "usd_conversion_basis": "source nominal; stablecoin quote not FX adjusted", "observed_at": fetched,
                   "refresh_error": error}
            rows.append(row); group.append(row)
        totals.append({"date": fetched[:10], "entity": dex or "core", "dex": dex or "core",
                       "value": sum(r["volume_24h_usd"] or 0 for r in group),
                       "volume_24h_usd": sum(r["volume_24h_usd"] or 0 for r in group),
                       "oi_usd_mark": sum(r["oi_usd_mark"] or 0 for r in group), "asset_count": len(group),
                       "active_metadata_count": sum(not r["is_delisted"] for r in group),
                       "missing_oi_assets": sum(r["oi_usd_mark"] is None for r in group),
                       "missing_volume_assets": sum(r["volume_24h_usd"] is None for r in group),
                       "collateral_token": payload[0].get("collateralToken"),
                       "quote_symbol": token_names.get(payload[0].get("collateralToken"), "unknown"),
                       "usd_conversion_basis": "source nominal; stablecoin quote not FX adjusted", "observed_at": fetched,
                       "refresh_error": error})
    asof = max(fetched_times) if fetched_times else enum_time
    source = {"name": "Hyperliquid 官方 info API", "url": HL,
              "documentationUrl": "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals", "licenseStatus": "unverified"}
    coverage = {"requestedDexCount": len(dex_names), "successfulDexCount": len(totals), "failedDexs": failed, "refreshErrors": refresh_errors,
                "totalUniverseRecords": len(rows), "collectionStartedAt": min(fetched_times) if fetched_times else enum_time,
                "collectionEndedAt": asof, "asOfBasis": "collection time; official current snapshot has no shared server timestamp",
                "productionEligible": False, "allDexsFetched": not failed and not refresh_errors and len(totals) == len(dex_names),
                "quoteMappingError": spot_error, "usdConversionApplied": False,
                "quoteAssets": sorted({r["quote_symbol"] for r in totals})}
    note = "官方无签名当前快照；默认Core与HIP-3逐DEX枚举。OI名义额=原生数量×标记价，未乘2；*_usd字段为源名义口径，非经过稳定币/法币汇率换算的美元金额。不同DEX使用USDC/USDH/USDE/USDT0，必须展示quote_symbol，不能把未换汇合计称精确法币USD。获取时间是采样时间，不是历史数据日。API再发布条件未作授权保证。"
    if failed:
        note += " 部分DEX读取失败，禁止展示全平台总量。"
    if refresh_errors:
        note += " 部分DEX刷新失败，保留各自原采样时间，不作本次全量最新快照。"
    age_seconds = (dt.datetime.now(UTC) - dt.datetime.fromisoformat(asof.replace("Z", "+00:00"))).total_seconds()
    common = {"source": source, "fetchedAt": asof, "asOf": asof, "grain": "current snapshot",
              "unit": "USD-pegged quote notional; no FX adjustment", "status": "stale" if refresh_errors or age_seconds > 86400 else "review", "note": note, "coverage": coverage}
    top = sorted(rows, key=lambda r: r["volume_24h_usd"] or 0, reverse=True)[:200]
    market = {**common, "id": "hl_markets_snapshot", "title": "Hyperliquid 官方市场快照",
              "dimensions": ["date", "entity", "dex", "coin"],
              "measures": ["value", "volume_24h_usd", "oi_usd_mark", "oi_native", "mark_price", "oracle_price", "funding_hourly"],
              "rows": top, "coverage": {**coverage, "rowCount": len(top), "truncated": len(rows) > 200, "selection": "Top 200 by 24h notional volume; totals use complete fetched universe"}}
    total = {**common, "id": "hl_dex_totals_snapshot", "title": "Hyperliquid 官方DEX汇总",
             "dimensions": ["date", "entity", "dex"], "measures": ["value", "volume_24h_usd", "oi_usd_mark", "asset_count"],
             "rows": totals, "coverage": {**coverage, "rowCount": len(totals)}}
    return [market, total]


def symbol_series_dataset(root, latest, offline):
    # Page-supported query parameters, using only returned asset names.
    attempted = now()
    request_results = []
    rows, sources, fetch_times, duplicate_symbols, duplicate_records = [], [], [], set(), 0
    selected = sorted(latest.get("rows", []), key=lambda x: x.get("value") or 0, reverse=True)[:5]
    for asset in selected:
        symbol = asset.get("symbol")
        if not symbol:
            continue
        path = "/api/hyperliquid/symbol?view=series&symbol=" + urllib.parse.quote(str(symbol), safe="")
        key = "hl_symbol_series_" + hashlib.sha256(str(symbol).encode()).hexdigest()[:12]
        payload, fetched, error = fetch(root, key, ORIGIN + path, offline=offline)
        raw = payload.get("data", []) if isinstance(payload, dict) else []
        request_error = error or ("No historical rows returned" if not isinstance(raw, list) or not raw else None)
        request_results.append({"symbol": str(symbol), "url": ORIGIN + path,
                                "attemptedAt": ATTEMPTS.get(ORIGIN + path, attempted),
                                "fetchedAt": fetched, "result": "failed" if request_error else "ok",
                                **({"error": str(request_error)[:500]} if request_error else {})})
        if not isinstance(raw, list):
            continue
        sources.append(ORIGIN + path); fetch_times.append(fetched)
        date_counts = {}
        for item in raw:
            date = date_of(item.get("date", item.get("day")))
            date_counts[date] = date_counts.get(date, 0) + 1
        for record_index, item in enumerate(raw):
            r = {slug(k): v for k, v in item.items() if not isinstance(v, (dict, list))}
            r["date"] = date_of(r.get("date", r.get("day")))
            if not r["date"]:
                continue
            r["entity"] = str(symbol); r["symbol"] = str(symbol)
            r["value"] = number(r.get("volume"))
            r["record_index"] = record_index
            if date_counts.get(r["date"], 0) > 1:
                duplicate_symbols.add(str(symbol)); duplicate_records += 1
                r["value"] = None
                r["validation_status"] = "duplicate_date_symbol; original volume and oi retained; do not aggregate"
            else:
                r["validation_status"] = "unique_date_symbol"
            rows.append(r)
    bounded, truncated = bound_rows(rows)
    dates = sorted({r["date"] for r in bounded})
    asof = dates[-1] if dates else None
    errors = [r["symbol"] + ": " + r["error"] for r in request_results if r["result"] == "failed"]
    return {"id": "hl_symbol_series", "title": "HIP-3 主要资产日历史",
            "source": {"name": "原站按资产公开缓存", "url": ORIGIN + "/dashboard/hyperliquid", "dataUrls": sources, "licenseStatus": "unverified"},
            "fetchedAt": max(fetch_times) if fetch_times else now(), "asOf": asof,
            "collection": {"attemptedAt": attempted, "result": "failed" if errors or not bounded else "ok",
                           **({"error": "; ".join(errors)[:500]} if errors else {})},
            "grain": "day × symbol", "unit": "USD (来源页面口径)", "dimensions": ["date", "entity", "symbol"],
            "measures": ["value", "volume", "oi"], "rows": bounded, "status": "stale" if asof and (dt.datetime.now(UTC).date()-dt.date.fromisoformat(asof)).days>1 else "review",
            "note": LICENSE_NOTE + " 仅采样最新Top5资产的日历史；来源symbol尚未和官方dex:coin完成身份映射，其他资产不伪造历史。" +
                    " 原站WTI/SPX等存在同日多行且无dex维度；保留原volume/oi，重复date×symbol的标准绘图value置null，禁止擅自相加。",
            "coverage": {"rowCount": len(bounded), "from": dates[0] if dates else None, "to": asof,
                         "requests": request_results, "refreshErrors": errors,
                         "sampleSymbols": [x.get("symbol") for x in selected], "truncated": truncated, "productionEligible": False,
                         "duplicateDateSymbols": sorted(duplicate_symbols), "rawDuplicateRecords": duplicate_records,
                         "chartEligibleSymbols": [x.get("symbol") for x in selected if x.get("symbol") not in duplicate_symbols]}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=pathlib.Path, default=pathlib.Path(__file__).parent)
    parser.add_argument("--offline", action="store_true", help="normalize already retrieved raw responses; no network")
    parser.add_argument("--origin-only", action="store_true", help="skip official live collection")
    parser.add_argument("--include-restricted", action="store_true", help="explicit research-only retrieval into restricted/; never included in output bundle")
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    def one(spec):
        restricted = spec[0] == "hl_fees_daily"
        payload, fetched, error = fetch(args.out, spec[0], ORIGIN + spec[2], offline=args.offline or (restricted and not args.include_restricted), restricted=restricted)
        result = origin_dataset(spec, payload, fetched, error)
        result["collection"]={"attemptedAt":ATTEMPTS.get(ORIGIN+spec[2],now()),"result":"not-configured" if restricted else "failed" if error or not result["rows"] else "ok",**({"error":str(error)[:500]} if error and not restricted else {})}
        print(spec[0], result["status"], len(result["rows"]), result["asOf"], flush=True)
        return result
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        datasets = list(pool.map(one, SPECS))
    datasets.append(symbol_series_dataset(args.out, next(d for d in datasets if d["id"]=="hl_symbol_latest"), args.offline))
    if not args.origin_only:
        datasets.extend(official_datasets(args.out, args.offline))
    if args.include_restricted:
        fetch(args.out, "dex_spot_restricted", "https://api.llama.fi/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true", offline=args.offline, restricted=True)
    datasets.extend([
        placeholder("dex_spot_market_share", "DEX 现货市场份额", "https://api.llama.fi/overview/dexs",
                    "免费接口技术可读，但DefiLlama条款限制未经许可的数据再发布；不将受限数据并入公开bundle。获得适用许可/替代来源后，用同日期breakdown及同一覆盖分母计算，现货与永续分开。", source_name="DefiLlama（受限）"),
        placeholder("dex_perp_market_share", "DEX 永续市场份额", "https://api-docs.defillama.com/llms.txt",
                    "官方文档将derivatives成交量API列为Pro-only；没有注册密钥或付费。免费OI不等于成交量，不替换指标。", source_name="DefiLlama Pro（未接入）"),
    ])
    for d in datasets:
        if "collection" not in d:
            c=d.get("coverage",{}); errors=c.get("refreshErrors") or c.get("failedDexs") or c.get("refreshError")
            disabled=d["id"] in ["dex_spot_market_share","dex_perp_market_share"]
            d["collection"]={"attemptedAt":ATTEMPTS.get(d["source"]["url"],now()),"result":"not-configured" if disabled else "failed" if errors or not d["rows"] else "ok",**({"error":str(errors)[:500]} if errors else {})}
    document = {"generatedAt": now(), "purpose": "research data assets for integration review; not proof of publication licence", "datasets": datasets}
    write_json(args.out / "datasets.json", document)
    print("Wrote", args.out / "datasets.json", "datasets", len(datasets), flush=True)


if __name__ == "__main__":
    main()
