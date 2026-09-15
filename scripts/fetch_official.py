#!/usr/bin/env python3
"""Verified public Binance archives and official read-only stock-token identity."""
import argparse, concurrent.futures, csv, datetime as dt, hashlib, io, json, math, pathlib, statistics, time, urllib.request, zipfile
from fetch_cex import iso, num
ROOT=pathlib.Path(__file__).resolve().parents[1]
FUNDING_SOURCE='https://data.binance.vision/?prefix=data/futures/um/monthly/fundingRate/BTCUSDT/'
OI_SOURCE='https://data.binance.vision/?prefix=data/futures/um/daily/metrics/BTCUSDT/'
RH_SOURCE='https://api.robinhood.com/rhj/assets'

def dataset(id,title,url,unit,grain,dimensions,measures):
    return {'id':id,'title':title,'source':{'name':'Binance 官方公开档案' if 'binance' in url else 'Robinhood 官方股票代币目录','url':url},
            'fetchedAt':'','asOf':None,'unit':unit,'grain':grain,'dimensions':dimensions,'measures':measures,'rows':[],
            'status':'pending','note':'等待官方来源采集。','coverage':{'sourceTier':'official'},
            'collection':{'attemptedAt':iso(time.time()),'result':'not-configured'}}

def placeholders():
    return [dataset('funding_btc_settled','Binance BTCUSDT 已结算日费率',FUNDING_SOURCE,'fraction','day',['date'],['value']),
            dataset('funding_zscore','Binance 已结算日费率 Z-score',FUNDING_SOURCE,'z-score','day',['date'],['value']),
            dataset('futures_oi_binance_official','Binance BTCUSDT 官方持仓核验',OI_SOURCE,'USD','5-minute',['date'],['value']),
            dataset('stock_token_registry','实际股票代币 · 官方合约目录',RH_SOURCE,'assets','snapshot',['entity'],['chainId'])]

def read(url):
    for attempt in range(2):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Web3DataCenter/3.0'}),timeout=25) as r:return r.read(8*1024*1024)
        except Exception:
            if attempt:raise
            time.sleep(2)

def archive(out,relative,offline=False):
    path=out/'raw'/relative.replace('/','_')
    meta=path.with_suffix('.metadata.json')
    # Completed public archives are immutable for this local run. Checksum is
    # always reverified on reuse, and original retrieval time stays visible.
    if path.exists() and meta.exists():
        raw=path.read_bytes();info=json.loads(meta.read_text())
    elif offline:raise FileNotFoundError(relative)
    else:
        url='https://data.binance.vision/data/futures/um/'+relative
        raw=read(url);checksum=read(url+'.CHECKSUM').decode().split()[0]
        info={'url':url,'sha256':checksum,'fetchedAt':iso(time.time())}
        if hashlib.sha256(raw).hexdigest()!=checksum:raise ValueError('Archive checksum mismatch')
        path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw);meta.write_text(json.dumps(info))
    if hashlib.sha256(raw).hexdigest()!=info['sha256']:raise ValueError('Archive checksum mismatch')
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        names=[n for n in z.namelist() if n.endswith('.csv')]
        if len(names)!=1 or z.getinfo(names[0]).file_size>8000000:raise ValueError('Unexpected archive')
        rows=list(csv.DictReader(io.StringIO(z.read(names[0]).decode('utf-8-sig'))))
    return rows,info

def settled_days(records,today):
    records=sorted(records,key=lambda r:int(r['calc_time']))
    times=[int(r['calc_time']) for r in records]
    if len(set(times))!=len(times):raise ValueError('Duplicate settlement timestamps')
    by_day={};invalid=set()
    for i,r in enumerate(records):
        t=int(r['calc_time']);date=dt.datetime.fromtimestamp(t/1000,dt.timezone.utc).date().isoformat()
        rate=num(r['last_funding_rate']);hours=num(r['funding_interval_hours'])
        if rate is None or hours is None or not 0<hours<=24:raise ValueError('Invalid settlement')
        if i and abs(t-times[i-1]-hours*3600000)>1000:invalid.add(date)
        by_day.setdefault(date,[]).append((rate,hours))
    return [{'date':date,'value':math.fsum(r for r,h in values),'settlements':len(values),
             'intervalHours':','.join(str(h) for r,h in values)}
            for date,values in sorted(by_day.items()) if date<today and date not in invalid and math.isclose(sum(h for r,h in values),24)]

def zscores(rows,window=90):
    by_date={r['date']:r['value'] for r in rows}
    if len(by_date)!=len(rows):raise ValueError('Duplicate daily rates')
    result=[]
    for date in sorted(by_date):
        end=dt.date.fromisoformat(date)
        keys=[(end-dt.timedelta(days=i)).isoformat() for i in range(window)]
        values=[by_date.get(k) for k in keys]
        value=None
        if all(isinstance(v,(int,float)) and math.isfinite(v) for v in values):
            sd=statistics.pstdev(values)
            if sd>0:value=(by_date[date]-statistics.fmean(values))/sd
        result.append({'date':date,'value':value,'dailyFundingRate':by_date[date]})
    return result

def funding(out,offline,today):
    datasets=placeholders()[:2];files=[];records=[];errors=[]
    month=today.replace(day=1)
    months=[]
    for _ in range(4):
        month=(month-dt.timedelta(days=1)).replace(day=1);months.append(month.strftime('%Y-%m'))
    for m in reversed(months):
        try:
            rows,info=archive(out,f'monthly/fundingRate/BTCUSDT/BTCUSDT-fundingRate-{m}.zip',offline)
            records.extend(rows);files.append(info)
        except Exception as e:errors.append(m+': '+type(e).__name__)
    daily=settled_days(records,today.isoformat())
    for d in datasets:
        d['rows']=daily if d['id']=='funding_btc_settled' else zscores(daily)
        d['asOf']=daily[-1]['date'] if daily else None
        d['fetchedAt']=max((f['fetchedAt'] for f in files),default='')
        d['status']='stale' if daily and (today-dt.date.fromisoformat(d['asOf'])).days>2 else 'ready' if daily else 'pending'
        d['collection']={'attemptedAt':iso(time.time()),'result':'failed' if errors else 'ok',**({'error':'; '.join(errors)} if errors else {})}
        d['coverage'].update(files=files,from_=daily[0]['date'] if daily else None,sourceThrough=d['asOf'],
            sourceFrom=daily[0]['date'] if daily else None,sourceTier='official',checksumVerified=bool(files),
            sourceFrequency='completed-month archives',formulaVersion='settled-utc-sum-rolling90-ddof0-v1',
            settlementRows=len(records),completeDays=len(daily),windowDays=90,windowIncludesCurrentDay=True)
        d['note']='官方已结算费率按实际结算时间归入UTC日并求和；按实际间隔校验24小时完整性。月度档案仅覆盖已公布月份，近期缺口保留；不是今日费率或持仓收益。'
        if d['id']=='funding_zscore':
            d['note']+=' Z=(当日日费率－最近90个完整连续UTC日均值)/总体标准差，窗口含当日；缺日或零方差不计算。原站聚合加权Z-score仍待口径核验。'
    return datasets

def open_interest(out,offline,today):
    d=placeholders()[2]
    for back in (1,2,3):
        date=(today-dt.timedelta(days=back)).isoformat()
        try:
            raw,info=archive(out,f'daily/metrics/BTCUSDT/BTCUSDT-metrics-{date}.zip',offline)
            rows=[]
            for r in raw:
                at=iso(r.get('create_time'));value=num(r.get('sum_open_interest_value'))
                if at and value is not None:rows.append({'date':at[:10],'timestamp':at,'value':value,'oiNative':num(r.get('sum_open_interest'))})
            rows.sort(key=lambda r:r['timestamp'])
            if len({r['timestamp'] for r in rows})!=len(rows):raise ValueError('Duplicate OI timestamps')
            d.update(rows=rows,asOf=rows[-1]['timestamp'] if rows else None,fetchedAt=info['fetchedAt'],status='ready' if rows else 'pending',
                     note='Binance官方BTCUSDT持仓名义价值；5分钟档案，按时间排序。不是抵押保证金，也不能与原站日close未经时点核对直接等同。')
            d['coverage'].update(files=[info],checksumVerified=True,sourceThrough=d['asOf'],sourceTier='official')
            d['collection']={'attemptedAt':iso(time.time()),'result':'ok'};return d
        except Exception as e:
            d['collection']={'attemptedAt':iso(time.time()),'result':'failed','error':type(e).__name__+': '+str(e)[:150]}
    return d

def stock_registry(out,offline):
    d=placeholders()[3];path=out/'raw/robinhood-assets.json'
    try:
        if offline:cached=json.loads(path.read_text())
        else:
            payload=json.loads(read(RH_SOURCE));cached={'payload':payload,'fetchedAt':iso(time.time())}
            path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(cached))
        rows=[]
        for asset in cached['payload']['assets']:
            for deployment in asset.get('deployments',[]):
                if deployment.get('chainId')!=4663:continue
                address=deployment.get('contractAddress','')
                if not __import__('re').fullmatch(r'0x[0-9A-Fa-f]{40}',address):raise ValueError('Invalid contract')
                rows.append({'entity':asset['tokenSymbol'],'name':asset.get('tokenName'), 'issuer':'Robinhood',
                             'chainId':4663,'contract':address,'productType':'股票代币',
                             'multiplier':asset.get('currentMultiplier'),'assetStatus':asset.get('status')})
        if len({r['contract'].lower() for r in rows})!=len(rows):raise ValueError('Duplicate token contract')
        d.update(rows=rows,asOf=cached['fetchedAt'],fetchedAt=cached['fetchedAt'],status='review',
                 note='Robinhood官方资产目录，限定主网chainId 4663；展示产品身份与合约，不代表全行业覆盖或发行量。与股票主题永续分开。未接入底层股票报价或将底层成交量当作代币成交量。')
        d['coverage'].update(sourceTier='official',productType='tokenized-stock',asOfBasis='collection time; source metadata has no common observation timestamp',
                             providersIncluded=['Robinhood'],candidateProviders={'xStocks':'公共数据使用条款待澄清','Ondo':'API须申请，费用与用途待确认'})
        d['collection']={'attemptedAt':iso(time.time()),'result':'ok'}
    except Exception as e:d['collection']={'attemptedAt':iso(time.time()),'result':'failed','error':type(e).__name__+': '+str(e)[:150]}
    return d

def main():
    p=argparse.ArgumentParser();p.add_argument('--out',type=pathlib.Path,required=True);p.add_argument('--offline',action='store_true');a=p.parse_args()
    a.out.mkdir(parents=True,exist_ok=True);today=dt.datetime.now(dt.timezone.utc).date()
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        fs=[pool.submit(funding,a.out,a.offline,today),pool.submit(open_interest,a.out,a.offline,today),pool.submit(stock_registry,a.out,a.offline)]
        datasets=fs[0].result()+[fs[1].result(),fs[2].result()]
    (a.out/'datasets.json').write_text(json.dumps({'datasets':datasets},ensure_ascii=False,separators=(',',':'),allow_nan=False))
    print(json.dumps({d['id']:{'rows':len(d['rows']),'asOf':d['asOf'],'status':d['status']} for d in datasets},ensure_ascii=False))
if __name__=='__main__':main()
