#!/usr/bin/env python3
"""Request server-side free BigModel generation; the API key never enters CI."""
import datetime,json,os,pathlib,subprocess,sys,urllib.request
from oidc_post import post
from analysis_retry import generate_with_retry
from collect import READ_HEADERS
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE='https://web3-market-center.raymondhuangj.chatgpt.site'
date=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).date().isoformat()
def context():
    with urllib.request.urlopen(urllib.request.Request(BASE+'/api/edition?date='+date,headers=READ_HEADERS),timeout=30) as r:return json.load(r)
ctx=context()
if ctx.get('status')=='waiting-for-data':
    # collect.py preserves actual pre-cutoff timestamps when recovery runs late.
    subprocess.run([sys.executable,str(ROOT/'scripts/collect.py')],check=True)
    subprocess.run([sys.executable,str(ROOT/'scripts/publish.py')],check=True)
    ctx=context()
if ctx.get('status')=='collecting':raise RuntimeError('Cutoff not reached')
if not ctx.get('snapshotId'):raise RuntimeError('No staged data; previous edition retained')
body=json.dumps({'snapshotId':ctx['snapshotId']},separators=(',',':')).encode()
if ctx.get('status')=='published':
    result={'accepted':True,'published':True,'snapshotId':ctx['snapshotId']}
else:
    result=generate_with_retry(lambda:post(BASE+'/api/admin/analysis/generate',body))
(ROOT/'work').mkdir(exist_ok=True)
(ROOT/'work/receipt.json').write_text(json.dumps(result))
if os.environ.get('GITHUB_OUTPUT'):
    with open(os.environ['GITHUB_OUTPUT'],'a') as out:out.write('published='+str(bool(result.get('published'))).lower()+'\n')
print(json.dumps(result))
