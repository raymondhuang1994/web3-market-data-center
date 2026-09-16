"""Small authenticated publisher shared by daily workflow phases."""
import datetime,email.utils,hashlib,json,math,os,re,urllib.parse,urllib.request,urllib.error
class PublishError(RuntimeError):
    def __init__(self,status,code='publication_failed',retryable=False,retry_after=None):
        self.status,self.code,self.retryable,self.retry_after=status,code,retryable,retry_after
        super().__init__('Publish HTTP '+str(status)+': '+code)

def header_delay(value,now=None):
    if not value:return None
    if re.fullmatch(r'[0-9]+',value.strip()):return int(value)
    try:
        parsed=email.utils.parsedate_to_datetime(value)
        if parsed.tzinfo is None:return None
        delay=math.ceil((parsed-(now or datetime.datetime.now(datetime.timezone.utc))).total_seconds())
        return delay if delay>=0 else None
    except (TypeError,ValueError,OverflowError):return None

def publication_error(status,raw,retry_after_header=None):
    try: data=json.loads(raw)
    except (ValueError,UnicodeError): data={}
    if not isinstance(data,dict):data={}
    code=data.get('error','')
    allowed={'bigmodel_'+x for x in ['platform_overloaded','account_rate_limited','account_balance_blocked','quota_exhausted','subscription_inactive','access_not_permitted','account_policy_restricted','key_missing','timeout','network_error','dns_error','tls_error','redirect_rejected','invalid_header','runtime_unsupported','response_too_large']}
    allowed.update('bigmodel_evidence_validation_failed_'+x for x in ['citation','text','point_count','sector','metadata','time','json','schema','incomplete'])
    if not isinstance(code,str) or (code not in allowed and not re.fullmatch(r'bigmodel_http_[1-5][0-9]{2}',code)):code='publication_failed'
    retryable=status in (429,503) and data.get('retryable',True) is True
    delay=data.get('retryAfterSeconds')
    if type(delay) is not int or delay<0 or delay>9007199254740991:delay=None
    header=header_delay(retry_after_header)
    if header is not None:delay=max(delay or 0,header)
    return PublishError(status,code,retryable,delay)
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):raise RuntimeError('Redirect refused')
def post(target,body,content_type='application/json'):
    parts=urllib.parse.urlsplit(os.environ['ACTIONS_ID_TOKEN_REQUEST_URL'])
    if parts.scheme!='https' or not parts.hostname.endswith('.actions.githubusercontent.com'):raise RuntimeError('Unexpected OIDC endpoint')
    query=[(k,v) for k,v in urllib.parse.parse_qsl(parts.query) if k!='audience']+[('audience',target+'#sha256='+hashlib.sha256(body).hexdigest())]
    url=urllib.parse.urlunsplit(parts._replace(query=urllib.parse.urlencode(query)))
    opener=urllib.request.build_opener(NoRedirect)
    req=urllib.request.Request(url,headers={'Authorization':'Bearer '+os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']})
    try:
        with opener.open(req,timeout=30) as r:token=json.load(r)['value']
    except urllib.error.HTTPError as e:
        raise PublishError(e.code,'oidc_request_failed',e.code==429 or e.code>=500,header_delay(e.headers.get('Retry-After'))) from None
    req=urllib.request.Request(target,data=body,headers={'Authorization':'Bearer '+token,'Content-Type':content_type,'User-Agent':'Web3MarketDataCenter/3.0'},method='POST')
    try:
        with opener.open(req,timeout=120) as r:result=json.load(r)
    except urllib.error.HTTPError as e:
        raise publication_error(e.code,e.read(4096),e.headers.get('Retry-After')) from None
    if not result.get('accepted'):raise RuntimeError('Publication rejected')
    return result
