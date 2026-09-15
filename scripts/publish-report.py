#!/usr/bin/env python3
"""Upload the generated PDF with a body- and snapshot-bound GitHub OIDC token."""
import hashlib,json,os,pathlib,urllib.request,urllib.parse,urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1]
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):raise RuntimeError('Redirect refused')
def main():
    receipt=json.loads((ROOT/'work/receipt.json').read_text())
    manifest=json.loads((ROOT/'work/web3-market-report.manifest.json').read_text())
    if manifest['snapshotId']!=receipt['snapshotId'] or manifest['generatedAt']!=receipt['generatedAt'] or not receipt.get('analysisHash') or manifest.get('analysisHash')!=receipt['analysisHash']:raise RuntimeError('Report snapshot or analysis mismatch')
    target='https://web3-market-center.raymondhuangj.chatgpt.site/api/admin/report?snapshot='+receipt['snapshotId']+'&analysis='+receipt['analysisHash']
    body=(ROOT/'work/web3-market-report.pdf').read_bytes()
    audience=target+'#sha256='+hashlib.sha256(body).hexdigest()
    parts=urllib.parse.urlsplit(os.environ['ACTIONS_ID_TOKEN_REQUEST_URL'])
    if parts.scheme!='https' or not parts.hostname.endswith('.actions.githubusercontent.com'):raise RuntimeError('Unexpected OIDC endpoint')
    query=[(k,v) for k,v in urllib.parse.parse_qsl(parts.query) if k!='audience']+[('audience',audience)]
    url=urllib.parse.urlunsplit(parts._replace(query=urllib.parse.urlencode(query)))
    opener=urllib.request.build_opener(NoRedirect)
    req=urllib.request.Request(url,headers={'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
    with opener.open(req,timeout=30) as r:token=json.load(r)['value']
    req=urllib.request.Request(target,data=body,headers={'Authorization':'Bearer '+token,'Content-Type':'application/pdf','User-Agent':'Web3MarketDataCenter/2.0 (+https://github.com/raymondhuang1994/web3-market-data-center)'},method='POST')
    with opener.open(req,timeout=120) as r:
        result=json.load(r)
        if not result.get('accepted'):raise RuntimeError('Report rejected')
        print(json.dumps(result))
if __name__=='__main__':
    try:main()
    except urllib.error.HTTPError as e:
        print(json.dumps({'status':e.code,'response':e.read(500).decode('utf8','replace')}));raise SystemExit(1)
