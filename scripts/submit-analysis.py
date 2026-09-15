#!/usr/bin/env python3
"""Submit a Codex-authored file. No model API call or paid data dependency."""
import datetime,json,os,pathlib,sys
from oidc_post import post
ROOT=pathlib.Path(__file__).resolve().parents[1]
date=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).date().isoformat()
path=ROOT/'data/analysis'/f'{date}.json'
a=json.loads(path.read_text())
if a.get('reportDate')!=date or a.get('producer')!='Codex':raise RuntimeError('Not today\'s Codex analysis')
result=post('https://web3-market-center.raymondhuangj.chatgpt.site/api/admin/analysis',path.read_bytes())
(ROOT/'work').mkdir(exist_ok=True)
(ROOT/'work/receipt.json').write_text(json.dumps(result))
if os.environ.get('GITHUB_OUTPUT'):
    with open(os.environ['GITHUB_OUTPUT'],'a') as out:out.write('published='+str(bool(result.get('published'))).lower()+'\n')
print(json.dumps(result))
