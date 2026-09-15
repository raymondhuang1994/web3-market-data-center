#!/usr/bin/env python3
"""Approved existing sector tabs. Free public reads; no account or trading calls."""
import argparse, concurrent.futures, datetime as dt, json, pathlib, time, urllib.parse, urllib.request
from fetch_cex import day, iso, num

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'https://data.wublock123.com'
SECTOR_FIELDS = [('', 'categories', '板块日成交额'), ('_assets', 'symbols', '标的日成交额'),
                 ('_exchanges', 'exchanges', '交易所日成交额'), ('_oi_assets', 'oi_symbols', '标的持仓历史'),
                 ('_oi_exchanges', 'oi_exchanges', '交易所持仓历史'), ('_funding', 'funding', '资金费率')]

def sector_url(label):
    return BASE + '/api/coinglass/futures/tradfi-volume-overview?' + urllib.parse.urlencode(
        {'source':'tag', 'label':label, 'interval':'1d', 'limit':180})

def labels():
    return [r['entity'] for d in json.loads((ROOT/'data/bootstrap.json').read_text())['datasets']
            if d['id']=='tradfi_labels' for r in d['rows'] if r['entity']!='Stocks']

def blank(label, suffix, title):
    return {'id':'sector_'+label+suffix,'title':label+' · '+title,
            'source':{'name':'吴说数据中心公开板块聚合','url':sector_url(label)},
            'fetchedAt':'','asOf':None,'grain':'snapshot' if suffix=='_funding' else 'day',
            'unit':'source-rate' if suffix=='_funding' else 'USD',
            'dimensions':['entity'] if suffix=='_funding' else ['date'],
            'measures':['sourceRate'] if suffix=='_funding' else ['value'], 'rows':[],
            'status':'pending','note':'保留原有板块；等待每日采集与逐指标核验。',
            'coverage':{'sector':label,'sourceTier':'origin','licenseStatus':'unverified'},
            'collection':{'attemptedAt':iso(time.time()),'result':'not-configured'}}

def normalize_sector(label, payload, fetched, error=None, today=None):
    today = today or dt.datetime.now(dt.timezone.utc).date().isoformat()
    data = payload.get('data', {}) if isinstance(payload,dict) else {}
    if not error and (str(payload.get('code'))!='0' or data.get('selected_label')!=label):
        error='来源板块身份或响应状态不一致'
    results=[]
    for suffix,bucket,title in SECTOR_FIELDS:
        d=blank(label,suffix,title)
        d['collection']={'attemptedAt':fetched,'result':'failed' if error else 'ok'}
        if error:
            d['collection']['error']=str(error)[:500];d['note']='本轮来源读取失败；保留栏目与上一有效快照。'
            results.append(d);continue
        series=data.get(bucket,[])
        if suffix=='_funding':
            rows=[{'entity':str(r.get('name','')), 'exchange':r.get('exchange'),
                   'date':day(r.get('time')), 'sourceRate':num(r.get('rate'))} for r in series]
            rows=[r for r in rows if r['entity'] and r['sourceRate'] is not None]
            d['rows']=rows[:200]
            dates=sorted(r['date'] for r in rows if r['date'])
            d['asOf']=dates[-1] if dates else None
        else:
            dates={};fields=[];duplicates=0
            for s in series:
                name=str(s.get('name',''))
                if not name or name in ('date','timestamp'):continue
                if name not in fields:fields.append(name)
                for p in s.get('points',[]):
                    date=day(p.get('time'))
                    if not date or date>=today:continue
                    row=dates.setdefault(date,{'date':date})
                    if name in row:
                        duplicates+=1;row[name]=None
                    else:row[name]=num(p.get('value'))
            selected=sorted(dates)[-90:]
            d['rows']=[{'date':date,**{f:dates[date].get(f) for f in fields}} for date in selected]
            d['measures']=fields or ['value'];d['asOf']=selected[-1] if selected else None
            d['coverage'].update(sourceDateCount=len(dates),from_=selected[0] if selected else None,
                                 sourceFrom=min(dates) if dates else None,sourceThrough=d['asOf'],
                                 retainedDays=90,truncated=len(dates)>90,duplicatePoints=duplicates,entities=fields)
        d['fetchedAt']=fetched
        d['status']='review' if d['rows'] else 'pending'
        d['coverage'].update(sourceUpdatedAt=iso(data.get('updated_at')),sourcePairCoverage=data.get('totals'),
                             sourceOiCoverage=data.get('oi_totals'),returnedRowCount=len(d['rows']),
                             sector=label,productType='thematic-perpetuals',periodCompleteVerified=False)
        d['note']=('原站板块分类下的合约交易数据；分类可重叠，不能相加为全市场。保存最近90个有记录日期，'
                   '排除当前未结束UTC日；缺日留空，实际历史覆盖及标的数量以本表为准。来源日界线、'
                   '交易对覆盖与公开使用条件仍待独立核验。')
        if suffix=='_funding':
            d['note']='来源实际返回的费率；单位与结算周期待核验，不跨交易所相加。' if d['rows'] else '该板块接口未返回资金费率；保留本栏，成交额或持仓成功不代表费率已接通。'
        results.append(d)
    return results

def collect_one(label,out,offline=False):
    key=urllib.parse.quote(label,safe='')
    path=out/'raw'/(key+'.json');attempted=iso(time.time())
    for attempt in range(2):
        try:
            if offline:
                cached=json.loads(path.read_text());return normalize_sector(label,cached['payload'],cached['fetchedAt'])
            request=urllib.request.Request(sector_url(label),headers={'User-Agent':'Web3DataCenter/3.0','Accept':'application/json'})
            with urllib.request.urlopen(request,timeout=30) as response:payload=json.load(response)
            fetched=iso(time.time());path.parent.mkdir(parents=True,exist_ok=True)
            path.write_text(json.dumps({'payload':payload,'fetchedAt':fetched},ensure_ascii=False))
            return normalize_sector(label,payload,fetched)
        except Exception as error:
            if attempt or offline:return normalize_sector(label,{},attempted,type(error).__name__+': '+str(error)[:250])
            time.sleep(2)

def main():
    p=argparse.ArgumentParser();p.add_argument('--out',type=pathlib.Path,required=True);p.add_argument('--offline',action='store_true');a=p.parse_args()
    a.out.mkdir(parents=True,exist_ok=True)
    datasets=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for group in pool.map(lambda label:collect_one(label,a.out,a.offline),labels()):
            datasets.extend(group)
            print(json.dumps({'sector':group[0]['coverage']['sector'],'datasetsWithRows':sum(bool(d['rows']) for d in group)},ensure_ascii=False),flush=True)
    (a.out/'datasets.json').write_text(json.dumps({'datasets':datasets},ensure_ascii=False,separators=(',',':'),allow_nan=False))

if __name__=='__main__':main()
