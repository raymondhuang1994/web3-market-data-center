#!/usr/bin/env python3
"""Collect approved public sources. No paid execution or trading calls."""
import concurrent.futures,datetime,json,pathlib,subprocess,sys,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'work'

def run(args):
    completed=subprocess.run([sys.executable,*map(str,args)],cwd=ROOT,timeout=900)
    return completed.returncode

def main():
    OUT.mkdir(exist_ok=True)
    now=datetime.datetime.now(datetime.timezone.utc)
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
        for d in previous['datasets']:
            if d.get('rows'):
                d['collection']={'attemptedAt':now.isoformat(),'result':'failed','error':'任务在09:00截止后运行，复用已存的截止前数据；没有取得新的准点采样'}
        result={'schemaVersion':1,'generatedAt':now.isoformat().replace('+00:00','Z'),'datasets':previous['datasets'],'edition':{'reportDate':date}}
        (OUT/'latest.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False))
        print(json.dumps({'reportDate':date,'cutoffAt':cutoff.isoformat(),'lateJob':True,'mode':'reuse-pre-cutoff-only'}))
        return
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(run,[ROOT/'scripts/fetch_cex.py','--output-dir',OUT/'cex']),pool.submit(run,[ROOT/'scripts/fetch_decentralized.py','--out',OUT/'decentralized'])]
        results=[task.result() for task in futures]
    baseline=json.loads((ROOT/'data/bootstrap.json').read_text())
    incoming={}
    for name in ['cex','decentralized']:
        p=OUT/name/'datasets.json'
        if p.exists():
            for d in json.loads(p.read_text())['datasets']: incoming[d['id']]=d
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
    result={'schemaVersion':1,'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z'),'datasets':datasets,'edition':{'reportDate':date}}
    (OUT/'latest.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False))
    print(json.dumps({'datasets':len(datasets),'withRows':sum(bool(d['rows']) for d in datasets),'collectorExitCodes':results,'generatedAt':result['generatedAt']}))
if __name__=='__main__':main()
