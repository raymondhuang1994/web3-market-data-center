#!/usr/bin/env python3
"""Fixed-cohort official perpetual volume samples. No keys or trading calls."""
import argparse, concurrent.futures, datetime as dt, decimal, json, pathlib, time, urllib.request
from fetch_cex import iso
SOURCE='https://github.com/raymondhuang1994/web3-market-data-center/blob/main/docs/SAMPLE_SHARE.md'
COHORT='hl-core-hip3_dydx-v4_lighter-eth-v1'
PROTOCOLS=['Hyperliquid (Core + HIP-3)','dYdX v4','Lighter']

def placeholder():
    return {'id':'dex_perp_market_share','title':'永续DEX · 已接入协议样本内份额',
            'source':{'name':'官方市场接口 · 本项目固定样本计算','url':SOURCE},
            'fetchedAt':'','asOf':None,'grain':'snapshot series','unit':'%',
            'dimensions':['date','entity'],'measures':['value'],'rows':[],'status':'pending',
            'note':'固定覆盖Hyperliquid（Core + HIP-3）、dYdX v4和Lighter永续。任一家失败时保留上一完整样本，不缩小分母。',
            'coverage':{'sourceTier':'derived','cohortVersion':COHORT,'expectedProtocols':PROTOCOLS},
            'collection':{'attemptedAt':iso(time.time()),'result':'not-configured'}}

def amount(v):
    if v is None or isinstance(v,bool):raise ValueError('Missing or invalid volume')
    n=decimal.Decimal(str(v))
    if not n.is_finite() or n<0:raise ValueError('Invalid volume')
    return n

def total(pairs):
    pairs=list(pairs)
    if not pairs or len({k for k,v in pairs})!=len(pairs):raise ValueError('Missing or duplicate markets')
    return sum((amount(v) for k,v in pairs),decimal.Decimal(0)),len(pairs)

def request(url,body=None):
    started=iso(time.time())
    for attempt in range(2):
        try:
            r=urllib.request.Request(url,data=json.dumps(body).encode() if body else None,
                headers={'Content-Type':'application/json','User-Agent':'Web3DataCenter/3.0'})
            with urllib.request.urlopen(r,timeout=25) as response:
                data=json.load(response);httpdate=response.headers.get('Date')
            return data,{'url':url,'request':body,'attemptedAt':started,'fetchedAt':iso(time.time()),'httpDate':httpdate}
        except Exception:
            if attempt:raise
            time.sleep(2)

def hyperliquid():
    url='https://api.hyperliquid.xyz/info';dexs,meta=request(url,{'type':'perpDexs'})
    names=['']+[d['name'] for d in dexs if d is not None]
    if len(names)!=len(set(names)):raise ValueError('Duplicate DEX namespaces')
    pairs=[];requests=[meta]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results=list(pool.map(lambda name:request(url,{'type':'metaAndAssetCtxs','dex':name}),names))
    for name,(data,metadata) in zip(names,results):
        if len(data)!=2 or len(data[0]['universe'])!=len(data[1]):raise ValueError('Incomplete Hyperliquid contexts')
        requests.append(metadata)
        for market,ctx in zip(data[0]['universe'],data[1]):pairs.append(((name,market['name']),ctx['dayNtlVlm']))
    value,count=total(pairs)
    return value,count,requests

def dydx():
    data,meta=request('https://indexer.dydx.trade/v4/perpetualMarkets')
    markets=data['markets']
    if not isinstance(markets,dict):raise ValueError('Invalid dYdX market set')
    value,count=total((m['ticker'],m['volume24H']) for m in markets.values())
    return value,count,[meta]

def lighter():
    root='https://mainnet.zklighter.elliot.ai/api/v1/'
    data,meta=request(root+'orderBookDetails');catalog,other=request(root+'orderBooks')
    markets=data['order_book_details']
    if not markets or any(m['market_type']!='perp' for m in markets):raise ValueError('Mixed Lighter market type')
    expected={m['market_id'] for m in catalog['order_books'] if m['market_type']=='perp'}
    if {m['market_id'] for m in markets}!=expected:raise ValueError('Incomplete Lighter market catalog')
    if any(m['status']!='active' and amount(m['daily_quote_token_volume'])>0 for m in markets):
        raise ValueError('Non-active market positive volume requires timestamp review')
    value,count=total((m['market_id'],m['daily_quote_token_volume']) for m in markets)
    return value,count,[meta,other]

def shares(values):
    if set(values)!=set(PROTOCOLS):raise ValueError('Incomplete fixed cohort')
    valid={name:amount(value) for name,value in values.items()};denominator=sum(valid.values())
    if denominator<=0:raise ValueError('Zero denominator')
    return {name:float(value/denominator*100) for name,value in valid.items()},denominator

def collect():
    d=placeholder();started=time.time();results={};errors={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        futures={name:pool.submit(f) for name,f in zip(PROTOCOLS,[hyperliquid,dydx,lighter])}
        for name,f in futures.items():
            try:results[name]=f.result()
            except Exception as e:errors[name]=type(e).__name__+': '+str(e)[:200]
    ended=time.time();d['coverage'].update(collectionStartedAt=iso(started),collectionEndedAt=iso(ended),
        collectionSpanSeconds=round(ended-started,3),failures=errors,
        requests={name:r[2] for name,r in results.items()},candidateExcluded={'Aster':'返回的部分成交统计窗口超过24小时或结束时间陈旧，待核验后加入新样本版本。'})
    d['collection']={'attemptedAt':iso(started),'result':'failed' if errors else 'ok'}
    if errors or ended-started>300:
        d['collection'].update(result='failed',error='固定三协议样本不完整或采样跨度超过5分钟；本轮不重算份额。')
        return d
    try:weights,denominator=shares({name:r[0] for name,r in results.items()})
    except ValueError as e:d['collection'].update(result='failed',error=str(e));return d
    date=dt.datetime.fromtimestamp(ended,dt.timezone(dt.timedelta(hours=8))).date().isoformat()
    d.update(fetchedAt=iso(ended),asOf=iso(ended),status='review',
        rows=[{'date':date,'entity':name,'value':weights[name],'volumeNominal':float(results[name][0]),
               'marketCount':results[name][1],'observed_at':max(r['fetchedAt'] for r in results[name][2]),
               'cohortVersion':COHORT,'unitBasis':'美元/锚定美元报价名义值，未换汇'} for name in PROTOCOLS])
    d['coverage'].update(denominatorNominal=float(denominator),sourceTier='derived',
        windowBasis='source-reported rolling 24h; statistical endpoints not synchronized',windowEnd=None,
        asOfBasis='collection completion, not shared source window end',historyPolicy='one complete cohort per Hong Kong date; keep up to 180 dates')
    d['note']+=' 采用各官方接口报告的滚动24小时成交名义额；各源实际统计终点不完全同步，采集时差见口径。稳定币按原生美元名义单位计算，未换汇。dYdX统计不含清算/去杠杆成交。未覆盖协议不记零、不列为“其他”；不表示全球DEX份额。'
    return d

def main():
    p=argparse.ArgumentParser();p.add_argument('--out',type=pathlib.Path,required=True);a=p.parse_args();a.out.mkdir(parents=True,exist_ok=True)
    d=collect();(a.out/'datasets.json').write_text(json.dumps({'datasets':[d]},ensure_ascii=False,separators=(',',':'),allow_nan=False))
    print(json.dumps({'id':d['id'],'rows':len(d['rows']),'asOf':d['asOf'],'status':d['status'],'failures':d['coverage'].get('failures')},ensure_ascii=False))
if __name__=='__main__':main()
