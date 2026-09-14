#!/usr/bin/env python3
"""Publish with a GitHub OIDC token bound to the exact JSON bytes."""
import hashlib,json,os,pathlib,urllib.parse,urllib.request
TARGET='https://web3-market-center.raymondhuangj.chatgpt.site/api/admin/ingest'
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):raise RuntimeError('Redirect refused')
def main():
    body=(pathlib.Path(__file__).resolve().parents[1]/'work/latest.json').read_bytes()
    audience=TARGET+'#sha256='+hashlib.sha256(body).hexdigest()
    raw=os.environ['ACTIONS_ID_TOKEN_REQUEST_URL'];parts=urllib.parse.urlsplit(raw)
    if parts.scheme!='https' or not parts.hostname.endswith('.actions.githubusercontent.com'):raise RuntimeError('Unexpected OIDC endpoint')
    query=urllib.parse.parse_qsl(parts.query);query=[(k,v) for k,v in query if k!='audience'];query.append(('audience',audience))
    url=urllib.parse.urlunsplit(parts._replace(query=urllib.parse.urlencode(query)))
    opener=urllib.request.build_opener(NoRedirect)
    request=urllib.request.Request(url,headers={'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
    with opener.open(request,timeout=30) as response:token=json.load(response)['value']
    request=urllib.request.Request(TARGET,data=body,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','User-Agent':'Web3MarketDataCenter/1.0 (+https://github.com/raymondhuang1994/web3-market-data-center)'},method='POST')
    with opener.open(request,timeout=120) as response:
        result=json.load(response)
        if not result.get('accepted'):raise RuntimeError('Snapshot rejected')
        print(json.dumps(result))
if __name__=='__main__':main()
