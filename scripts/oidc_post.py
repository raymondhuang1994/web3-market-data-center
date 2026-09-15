"""Small authenticated publisher shared by daily workflow phases."""
import hashlib,json,os,urllib.parse,urllib.request,urllib.error
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):raise RuntimeError('Redirect refused')
def post(target,body,content_type='application/json'):
    parts=urllib.parse.urlsplit(os.environ['ACTIONS_ID_TOKEN_REQUEST_URL'])
    if parts.scheme!='https' or not parts.hostname.endswith('.actions.githubusercontent.com'):raise RuntimeError('Unexpected OIDC endpoint')
    query=[(k,v) for k,v in urllib.parse.parse_qsl(parts.query) if k!='audience']+[('audience',target+'#sha256='+hashlib.sha256(body).hexdigest())]
    url=urllib.parse.urlunsplit(parts._replace(query=urllib.parse.urlencode(query)))
    opener=urllib.request.build_opener(NoRedirect)
    req=urllib.request.Request(url,headers={'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
    with opener.open(req,timeout=30) as r:token=json.load(r)['value']
    req=urllib.request.Request(target,data=body,headers={'Authorization':'Bearer '+token,'Content-Type':content_type,'User-Agent':'Web3MarketDataCenter/3.0'},method='POST')
    try:
        with opener.open(req,timeout=120) as r:result=json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError('Publish HTTP '+str(e.code)+': '+e.read(500).decode('utf8','replace')) from None
    if not result.get('accepted'):raise RuntimeError('Publication rejected')
    return result
