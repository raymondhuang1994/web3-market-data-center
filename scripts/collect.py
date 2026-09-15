#!/usr/bin/env python3
"""Collect approved public sources. No paid execution or trading calls."""
import concurrent.futures,datetime,json,pathlib,subprocess,sys,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'work'

def align_contract(datasets,baseline):
    incoming={d['id']:d for d in datasets}
    result=[]
    for old in baseline['datasets']:
        d=incoming.get(old['id'])
        if not d or d.get('unit')!=old['unit'] or d.get('source',{}).get('url')!=old['source']['url']:
            d={**old,'rows':[],'asOf':None,'fetchedAt':'','status':'pending',
               'collection':{'attemptedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'result':'not-configured'}}
        result.append(d)
    return result

def add_verification(datasets):
    mapped={d['id']:d for d in datasets}
    official=mapped.get('funding_btc_settled')
    if official and official['rows']:
        for id in ['funding_btc','funding_oi_btc','funding_vol_btc']:
            d=mapped.get(id)
            if not d:continue
            d.setdefault('coverage',{})['officialVerification']={
                'datasetId':'funding_btc_settled','through':official['asOf'],'result':'inconclusive',
                'reason':'已取得校验通过的官方逐次结算档案；原源日OHLC与已结算日合计不是同一指标，尚不能批准原单位或加权口径。'}
    original=mapped.get('futures_oi_exchange_btc');official=mapped.get('futures_oi_binance_official')
    if original and official and official['rows']:
        lookup={r['date']:r for r in official['rows']}
        pairs=[(r,lookup[r['date']]) for r in original['rows'] if r.get('date') in lookup and isinstance(r.get('value'),(int,float))]
        audit={'datasetId':'futures_oi_binance_official','through':official['asOf'],'result':'inconclusive',
               'reason':'官方5分钟名义价值与原源日close的统计时点不同；差额仅作核验线索，不自动批准原单位。'}
        if pairs:
            source,ref=pairs[-1]
            audit.update(matchedDate=source['date'],officialObservedAt=ref['timestamp'])
            if ref['value']:audit['relativeDifferencePct']=(source['value']/ref['value']-1)*100
        original.setdefault('coverage',{})['officialVerification']=audit
    return datasets

def run(args):
    try:
        completed=subprocess.run([sys.executable,*map(str,args)],cwd=ROOT,timeout=720)
        return completed.returncode
    except (subprocess.TimeoutExpired,OSError) as error:
        print(json.dumps({'collector':pathlib.Path(args[0]).name,'error':type(error).__name__}))
        return 124

def main():
    OUT.mkdir(exist_ok=True)
    now=datetime.datetime.now(datetime.timezone.utc)
    baseline=json.loads((ROOT/'data/bootstrap.json').read_text())
    contracts={d['id']:d for d in baseline['datasets']}
    contracts.update({d['id']:d for d in json.loads((ROOT/'data/source-registry.json').read_text())})
    baseline['datasets']=list(contracts.values())
    date=now.astimezone(datetime.timezone(datetime.timedelta(hours=8))).date().isoformat()
    cutoff=datetime.datetime.fromisoformat(date+'T01:00:00+00:00')
    # Never fetch current-only market endpoints after the cutoff and pretend
    # those observations existed at 09:00. Late jobs reuse eligible stored data.
    if now>=cutoff:
        base='https://web3-market-center.raymondhuangj.chatgpt.site'
        with urllib.request.urlopen(base+'/api/edition?date='+date,timeout=30) as response:edition=json.load(response)
        path='/api/data'+('?snapshot='+edition['snapshotId'] if edition.get('snapshotId') else '')
        with urllib.request.urlopen(base+path,timeout=60) as response:previous=json.load(response)
        if previous.get('delivery')=='bootstrap':raise RuntimeError('No trusted prior snapshot; late collection stopped')
        previous['datasets']=align_contract(previous['datasets'],baseline)
        for d in previous['datasets']:
            if d.get('rows'):
                d['collection']={'attemptedAt':now.isoformat(),'result':'failed','error':'任务在09:00截止后运行，复用已存的截止前数据；没有取得新的准点采样'}
        result={'schemaVersion':1,'generatedAt':now.isoformat().replace('+00:00','Z'),'datasets':previous['datasets'],'edition':{'reportDate':date}}
        (OUT/'latest.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False))
        print(json.dumps({'reportDate':date,'cutoffAt':cutoff.isoformat(),'lateJob':True,'mode':'reuse-pre-cutoff-only'}))
        return
    names=['cex','decentralized','expansion','official','perps']
    # Remove only derived output, preserving caches; a failed process must never
    # turn a previous run's datasets.json into a new successful observation.
    for name in names:
        (OUT/name/'datasets.json').unlink(missing_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        futures=[pool.submit(run,[ROOT/'scripts/fetch_cex.py','--output-dir',OUT/'cex']),pool.submit(run,[ROOT/'scripts/fetch_decentralized.py','--out',OUT/'decentralized']),
                 *[pool.submit(run,[ROOT/f'scripts/fetch_{name}.py','--out',OUT/name]) for name in ['expansion','official','perps']]]
        results=[task.result() for task in futures]
    incoming={}
    for name,code in zip(names,results):
        p=OUT/name/'datasets.json'
        if code==0 and p.exists():
            try:
                group={d['id']:d for d in json.loads(p.read_text())['datasets']}
                incoming.update(group)
            except (ValueError,KeyError,TypeError):
                print(json.dumps({'collector':name,'error':'Invalid output'}))
    datasets=[]
    for old in baseline['datasets']:
        d=incoming.get(old['id'])
        if not d or not d.get('rows') and old['rows'] or d.get('unit')!=old['unit'] or d.get('source',{}).get('url')!=old['source']['url']:
            # The server merges its actual last-good version; this empty signal
            # intentionally cannot replace production data with an old checkout.
            audit=d.get('collection') if d else None
            d={**old,'rows':[],'status':'pending','note':'本轮来源不可用或口径变化；请求保留上一有效快照。','collection':audit or {'attemptedAt':datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z'),'result':'failed','error':'来源未返回有效数据或数据契约发生变化'}}
        datasets.append(d)
    if not any(d['rows'] for d in datasets):raise RuntimeError('No source succeeded; previous published snapshot retained')
    result={'schemaVersion':1,'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z'),'datasets':add_verification(datasets),'edition':{'reportDate':date}}
    (OUT/'latest.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False))
    print(json.dumps({'datasets':len(datasets),'withRows':sum(bool(d['rows']) for d in datasets),'collectorExitCodes':results,'generatedAt':result['generatedAt']}))
if __name__=='__main__':main()
