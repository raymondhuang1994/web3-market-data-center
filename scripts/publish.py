#!/usr/bin/env python3
"""Publish with a GitHub OIDC token bound to the exact JSON bytes."""
import base64,hashlib,json,os,pathlib,urllib.parse,urllib.request,urllib.error
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
    claims=json.loads(base64.urlsafe_b64decode(token.split('.')[1]+'==='))
    fields=['iss','repository','repository_id','repository_owner_id','repository_visibility','ref','ref_type','workflow_ref','event_name','runner_environment','sub','iat','nbf','exp','run_id','run_attempt','run_number']
    print(json.dumps({'oidcIdentity':{k:claims.get(k) for k in fields},'audienceMatches':claims.get('aud')==audience}))
    request=urllib.request.Request(TARGET,data=body,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','User-Agent':'Web3MarketDataCenter/1.0 (+https://github.com/raymondhuang1994/web3-market-data-center)'},method='POST')
    with opener.open(request,timeout=120) as response:
        result=json.load(response)
        if not result.get('accepted'):raise RuntimeError('Snapshot rejected')
        print(json.dumps(result))
if __name__=='__main__':
    try:main()
    except urllib.error.HTTPError as error:
        print(json.dumps({'status':error.code,'response':error.read(500).decode('utf-8','replace')}))
        raise SystemExit(1)
