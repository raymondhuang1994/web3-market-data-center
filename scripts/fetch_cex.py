#!/usr/bin/env python3
"""Read-only public CEX/TradFi data collector. Python standard library only.
Run: python3 fetch_cex.py --output-dir /some/private/staging
Use --from-cache to normalize existing raw/*.raw without network.
All output is research data with attribution; public readability is not a grant
of redistribution rights. No account, key, trading, query execution, or POST API.
"""
import argparse, concurrent.futures, datetime as dt, json, math, pathlib, re, time, urllib.request
BASE = 'https://data.wublock123.com'
PATHS = {
 'cex_spot_daily':'/json/cex-asset-vol/cex_exchange_daily_spot_volume_usd.json',
 'cex_futures_daily':'/json/cex-asset-vol/cex_exchange_daily_futures_volume_usd.json',
 'cex_spot_monthly':'/json/cex-asset-vol/cex_exchange_monthly_spot_volume_usd.json',
 'cex_futures_monthly':'/json/cex-asset-vol/cex_exchange_monthly_futures_volume_usd.json',
 'cex_reserves_daily':'/json/cex-asset-vol/cex_exchange_daily_assets_usd.json',
 'futures_oi_btc':'/api/coinglass/futures/aggregated-open-interest-history?symbol=BTC&interval=1d&limit=180',
 'futures_oi_eth':'/api/coinglass/futures/aggregated-open-interest-history?symbol=ETH&interval=1d&limit=180',
 'futures_oi_exchange_btc':'/json/futures-open-interest-history/Binance_BTCUSDT_1d.json',
 'futures_oi_stablecoin_btc':'/json/futures-open-interest-aggregated-stablecoin-history/BTC_1d.json',
 'futures_oi_coin_btc':'/json/futures-open-interest-aggregated-coin-margin-history/BTC_1d.json',
 'funding_btc':'/api/coinglass/futures/realtime-funding-rate/multi-exchange?symbol=BTC&interval=1d&limit=180&exchange=Binance&pair=BTCUSDT',
 'funding_oi_btc':'/json/futures-funding-rate-oi-weight-history/BTC_1d.json',
 'funding_vol_btc':'/json/futures-funding-rate-vol-weight-history/BTC_1d.json',
 'funding_arbitrage':'/api/coinglass/futures/funding-rate-arbitrage?usd=10000',
 'spot_volume_btc':'/api/coinglass/spot/aggregated-volume-history?symbol=BTC&interval=1d&limit=180',
 'futures_volume_btc':'/api/coinglass/futures/aggregated-volume-history?symbol=BTC&interval=1d&limit=180',
 'tradfi_labels':'/api/coinglass/futures/tradfi-volume-overview?source=tag&labels_only=1',
 'tradfi_stocks':'/api/coinglass/futures/tradfi-volume-overview?source=tag&label=Stocks&interval=1d&limit=180',
 'tradfi_deep':'/api/tradfi/deep?label=Stocks',
 'tradfi_arbitrage':'/dashboard/tradfi-spot-arb',
 'stablecoin_marketcap':'/api/coinglass/index/stableCoin-marketCap-history',
}
TITLES = {
 'cex_spot_daily':'交易场所现货日成交额','cex_futures_daily':'交易场所合约日成交额',
 'cex_spot_monthly':'交易场所现货月成交额','cex_futures_monthly':'交易场所合约月成交额',
 'cex_reserves_daily':'交易场所公开资产历史','futures_oi_btc':'BTC 全市场聚合持仓',
 'futures_oi_eth':'ETH 全市场聚合持仓','futures_oi_exchange_btc':'Binance BTCUSDT 持仓历史',
 'futures_oi_stablecoin_btc':'BTC 稳定币本位合约持仓','futures_oi_coin_btc':'BTC 币本位合约持仓',
 'funding_btc':'Binance BTCUSDT 资金费率','funding_oi_btc':'BTC 持仓加权资金费率',
 'funding_vol_btc':'BTC 成交加权资金费率','funding_arbitrage':'跨所资金费率比较',
 'spot_volume_btc':'BTC 聚合现货成交额','futures_volume_btc':'BTC 聚合合约成交额',
 'tradfi_labels':'热门板块分类目录','tradfi_stocks':'Stocks 永续合约成交趋势',
 'tradfi_arbitrage':'TradFi 跨市场参考报价','stablecoin_marketcap':'稳定币市值历史',
}
UTC=dt.timezone.utc
NOW=dt.datetime.now(UTC)
def iso(x):
 if x is None or x=='': return None
 if isinstance(x,(int,float)) or (isinstance(x,str) and x.isdigit()):
  v=float(x);v=v/1000 if abs(v)>100000000000 else v
  try:return dt.datetime.fromtimestamp(v,UTC).isoformat().replace('+00:00','Z')
  except (ValueError,OverflowError,OSError):return None
 s=str(x).replace(' UTC','+00:00')
 try:
  parsed=dt.datetime.fromisoformat(s.replace('Z','+00:00'));parsed=parsed.replace(tzinfo=UTC) if parsed.tzinfo is None else parsed.astimezone(UTC)
  return parsed.isoformat().replace('+00:00','Z')
 except ValueError:return None

def day(x):
 s=iso(x);return s[:10] if s else None

def num(x):
 if x is None or isinstance(x,bool):return None
 try:
  n=float(x);return n if math.isfinite(n) else None
 except (TypeError,ValueError):return None

def flat(rows):
 return [{str(k):v for k,v in r.items() if v is None or isinstance(v,(str,int,float,bool))} for r in rows]

class Collector:
 def __init__(self,out,cache):
  self.out=pathlib.Path(out);self.raw=self.out/'raw';self.raw.mkdir(parents=True,exist_ok=True)
  self.cache=cache;self.errors={};self.docs={};self.fetched={};self.attempted={};self.datasets=[]
 def fetch(self,item):
  key,path=item; f=self.raw/(key+'.raw');self.attempted[key]=iso(time.time())
  try:
   if not self.cache:
    error=None
    for attempt in range(2):
     try:
      req=urllib.request.Request(BASE+path,headers={'User-Agent':'Web3DataCenter-Research/0.1','Accept':'application/json,text/html'})
      with urllib.request.urlopen(req,timeout=30) as response:body=response.read(8*1024*1024)
      tmp=f.with_suffix('.tmp');tmp.write_bytes(body);tmp.replace(f);error=None;break
     except Exception as e:error=e;time.sleep(attempt+1)
    if error:raise error
   text=f.read_text();data=text if key=='tradfi_arbitrage' else json.loads(text)
   if isinstance(data,dict) and (data.get('ok') is False or ('code' in data and str(data['code'])!='0')):
    raise ValueError('Source error: '+str(data.get('msg',data.get('error'))))
   self.docs[key]=data;self.fetched[key]=iso(f.stat().st_mtime)
  except Exception as e:self.errors[key]=str(e)
 def add(self,id,source,rows,grain,unit,dimensions,measures,note='',status=None,title=None,coverage=None,asof=None):
  original=flat(rows); rows=original
  dated=[r['date'] for r in rows if r.get('date')]
  if dated:
   unique=sorted(set(dated)); start=unique[-180] if len(unique)>180 else unique[0]
   rows=[r for r in rows if not r.get('date') or r['date']>=start]
   rows=sorted(rows,key=lambda r:(r.get('date',''),str(r.get('entity',''))))[-1000:]
  else:rows=rows[:200]
  through=asof or (max(dated) if dated else None)
  if status is None:
   status='ready' if rows else 'pending'
   if rows and through:
    x=iso(through)
    if x:
     lag=(NOW-dt.datetime.fromisoformat(x.replace('Z','+00:00'))).total_seconds()
     limit=65*86400 if grain=='month' else 3*86400
     if lag>limit:status='stale'
   elif rows:status='review'
  c={'sourceRowCount':len(original),'returnedRowCount':len(rows),'sourceFrom':min(dated) if dated else None,'sourceThrough':max(dated) if dated else None,'truncated':len(rows)<len(original),'licenseStatus':'unverified'}
  if coverage:c.update(coverage)
  if grain=='month' and through:
   current=dt.date.fromisoformat(through[:10]);following=dt.date(current.year+1,1,1) if current.month==12 else dt.date(current.year,current.month+1,1)
   end=following-dt.timedelta(days=1)
   if following<=NOW.date():
    through=end.isoformat();c['periodConvention']='rows use month-start; asOf is completed month-end'
   else:
    through=NOW.date().isoformat();c['periodConvention']='latest month is partial; do not compare with completed months';c['latestPeriodComplete']=False
  self.datasets.append({'id':id,'title':title or TITLES.get(id,id),'source':{'name':'吴说数据中心公开数据（原站聚合）','url':BASE+PATHS.get(source,'/dashboard')},'fetchedAt':self.fetched.get(source,iso(NOW.timestamp())),'asOf':through,'grain':grain,'unit':unit,'dimensions':dimensions,'measures':measures,'rows':rows,'status':status,'note':note,'coverage':c,'collection':{'attemptedAt':self.attempted.get(source,iso(time.time())),'result':'not-configured' if id=='cex_reserve_score' else 'ok' if rows and source not in self.errors else 'failed',**({'error':str(self.errors[source])[:500]} if source in self.errors else {})}})
 def points(self,key,rows,unit='USD',status=None,note='',source=None,entity=None,title=None):
  result=[]
  for r in rows:
   if not day(r.get('time')):continue
   z={'date':day(r['time']),'timestamp':iso(r['time']),'entity':entity or ('ETH' if key.endswith('_eth') else 'BTC')}
   for f in ['open','high','low','close','volume_usd','value']:
    if f in r:z[f]=num(r[f])
   z['value']=z.get('volume_usd',z.get('value',z.get('close')));result.append(z)
  self.add(key,source or key,result,'day',unit,['date','entity'],list(dict.fromkeys(['value']+[k for r in result for k in r if k not in ('date','timestamp','entity','value')])),note,status,title)
 def normalize(self):
  for key in ['cex_spot_daily','cex_futures_daily','cex_spot_monthly','cex_futures_monthly','cex_reserves_daily']:
   if key not in self.docs:continue
   d=self.docs[key]['data'];fields=[k for k in d['exchanges'] if 'date' not in k.lower()];rows=[]
   for r in d['rows']:
    date=r.get('date') or r.get('month','')+'-01';rows.append({'date':date,**{k:num(r.get(k)) for k in fields}})
   self.add(key,key,rows,'month' if 'monthly' in key else 'day','USD',['date'],fields,'原站收录样本包含 Hyperliquid/Uniswap；应按场所类型筛选。ALL 是源合计，不得与单所列重复加总。资产规模不代表负债覆盖或偿付能力。' if 'reserves' in key else '原站收录交易场所样本，含去中心化场所；份额分母需明确收录集合，不能称全球份额。ALL 不得重复相加。',coverage={'sourceUpdatedAt':d.get('generated_at'),'entities':fields,'classification':{'Hyperliquid':'DEX','Uniswap':'DEX','otherListedVenues':'CEX'}})
  for key in ['futures_oi_btc','futures_oi_eth','spot_volume_btc','futures_volume_btc']:
   if key not in self.docs:continue
   a=self.docs[key]['data'].get('asset',{});rows=a.get('points',[])
   is_oi='oi_' in key
   unit_ok=(not is_oi) or (num(a.get('latestOiUsd')) is not None and bool(rows) and num(rows[-1].get('close')) is not None and math.isclose(float(a['latestOiUsd']),float(rows[-1]['close']),rel_tol=1e-7))
   self.points(key,rows,unit='USD' if unit_ok else 'source-unit',status=None if unit_ok else 'review',note='聚合持仓USD由源latestOiUsd字段与最后close一致确认；不是抵押保证金。' if is_oi and unit_ok else ('源volume_usd为美元成交额；close为聚合收盘参考价，不能当可执行成交报价。' if not is_oi else '未通过源latestOiUsd与close一致性核验，保留原值待复核。'))
  if 'futures_oi_exchange_btc' in self.docs:
   self.points('futures_oi_exchange_btc',self.docs['futures_oi_exchange_btc']['data'],unit='source-unit',status='review',entity='Binance · BTCUSDT',note='原站页面标USD，裸JSON无unit字段；保留原始数值。需与交易所名义美元OI交叉核验后改为USD。')
  for key in ['futures_oi_stablecoin_btc','futures_oi_coin_btc']:
   if key in self.docs:self.points(key,self.docs[key]['data'],unit='source-unit',status='review',note='源端点是按保证金币种拆分的合约持仓，并非实际抵押保证金。两文件量纲可能不同，未确认前不得相加、自动换汇或标USD。')
  for key in ['funding_oi_btc','funding_vol_btc']:
   if key in self.docs:self.points(key,self.docs[key]['data'],unit='source-rate',status='review',note='保留源费率原值。原站UI乘100，而上游示例未明示fraction/百分比；单位未独立核验前不乘100、不年化。1d是采样桶而非结算间隔。')
  if 'funding_btc' in self.docs:
   d=self.docs['funding_btc']['data'];rows=[]
   for exchange,series in d.get('exchange_series',{}).items():
    for p in series:rows.append({'date':day(p.get('time')),'entity':exchange,'instrument':d.get('pair_map',{}).get(exchange),'value':num(p.get('close')),'open':num(p.get('open')),'high':num(p.get('high')),'low':num(p.get('low'))})
   self.add('funding_btc','funding_btc',rows,'day','source-rate',['date','entity','instrument'],['value','open','high','low'],'源费率原值；尚未证明fraction/百分比单位，禁止盲目乘100或套用8h。','review')
  if 'funding_arbitrage' in self.docs:
   rows=[]
   for r in self.docs['funding_arbitrage']['data']:
    b=r.get('buy',{});s=r.get('sell',{})
    rows.append({'entity':r.get('symbol'),'buyExchange':b.get('exchange'),'sellExchange':s.get('exchange'),'sourceApr':num(r.get('apr')),'sourceFundingSpread':num(r.get('funding')),'sourceFee':num(r.get('fee')),'sourcePriceSpread':num(r.get('spread')),'buyFundingRate':num(b.get('funding_rate')),'sellFundingRate':num(s.get('funding_rate')),'buyIntervalHours':num(b.get('funding_rate_interval')),'sellIntervalHours':num(s.get('funding_rate_interval')),'buyOiUsd':num(b.get('open_interest_usd')),'sellOiUsd':num(s.get('open_interest_usd')),'nextFundingTime':iso(r.get('next_funding_time'))})
   self.add('funding_arbitrage','funding_arbitrage',rows,'snapshot','mixed',['entity','buyExchange','sellExchange'],['sourceApr','sourceFundingSpread','sourceFee','sourcePriceSpread','buyFundingRate','sellFundingRate','buyIntervalHours','sellIntervalHours','buyOiUsd','sellOiUsd'],'源年度化估值和费率原值，非保证收益；未提供观察时间。nextFundingTime不是数据更新时间。保留实际间隔；缺失不补零。','review')
  if 'tradfi_labels' in self.docs:
   rows=[{'entity':r['name'],'pairCount':r['pair_count']} for r in self.docs['tradfi_labels']['data']['available_labels']]
   self.add('tradfi_labels','tradfi_labels',rows,'snapshot','pairs',['entity'],['pairCount'],'pairCount是来源交易对覆盖数，不是公司/独立股票代币数。完整28类保留。','ready',coverage={'observedAt':self.fetched['tradfi_labels']})
  if 'tradfi_stocks' in self.docs:
   d=self.docs['tradfi_stocks']['data']
   for key,bucket,title in [('tradfi_stocks','categories','Stocks 永续合约日成交'),('tradfi_stock_assets','symbols','Stocks 标的日成交'),('tradfi_stock_exchanges','exchanges','Stocks 交易所日成交'),('tradfi_stock_oi_assets','oi_symbols','Stocks 标的持仓历史'),('tradfi_stock_oi_exchanges','oi_exchanges','Stocks 交易所持仓历史')]:
    # Wide daily representation preserves all returned series inside the 1000-row cap.
    dates={};fields=[]
    for series in d.get(bucket,[]):
     entity=series['name'];fields.append(entity)
     for p in series.get('points',[]):
      date=day(p.get('time'))
      if date:dates.setdefault(date,{'date':date})[entity]=num(p.get('value'))
    rows=[{'date':date,**{f:r.get(f) for f in fields}} for date,r in sorted(dates.items())]
    self.add(key,'tradfi_stocks',rows,'day','USD',['date'],fields,'CEX/Hyperliquid股票主题永续；不等于链上股票代币现货。只含接口返回的资产/场所系列，分类可重叠。',title=title,coverage={'sourceUpdatedAt':iso(d.get('updated_at')),'sourcePairCoverage':d.get('totals'),'sourceOiCoverage':d.get('oi_totals'),'entities':fields})
   rows=[{'date':day(r.get('time')),'entity':r.get('name'),'exchange':r.get('exchange'),'sourceRate':num(r.get('rate'))} for r in d.get('funding',[])]
   self.add('tradfi_stock_funding','tradfi_stocks',rows,'snapshot','source-rate',['date','entity','exchange'],['sourceRate'],'板块源最新费率，结算周期与百分比单位待核验；不跨所相加。','review',title='Stocks 标的费率')
  if 'tradfi_deep' in self.docs:
   d=self.docs['tradfi_deep']['data'];rows=[]
   for r in d.get('exchanges',[]):
    z=dict(r);z['entity']=z.pop('exchange');
    if z.get('focusHits')==0:
     for f in ['oiUsd','fundingRate','premiumPct']:z[f]=None
    rows.append(z)
   self.add('tradfi_exchange_comparison','tradfi_deep',rows,'snapshot','mixed',['entity'],['volumeUsd','oiUsd','fundingRate','premiumPct','focusHits'],'成交覆盖整个返回板块；OI/费率/溢价仅焦点标的。focusHits=0的伪零归为null。指数溢价不是美股现货溢价；不同字段时点可能不同。','review',title='Stocks 交易所横向比较',coverage={'focusSymbols':d.get('focusSymbols'),'sourceUpdatedAt':iso(d.get('updatedAt'))})
  if 'stablecoin_marketcap' in self.docs:
   rows=[];fields=[]
   for r in self.docs['stablecoin_marketcap']['data']:
    z={'date':day(r.get('time'))}
    for k,v in r.items():
     if k!='time':z[k]=num(v);fields.append(k)
    rows.append(z)
   self.add('stablecoin_marketcap','stablecoin_marketcap',rows,'day','USD',['date'],list(dict.fromkeys(fields)),'总市值、11个币种/币种组合、15条链；USDS/DAI合并。并非币种×链交叉矩阵；细分可能不完整，不强行凑总数。')
  if 'tradfi_arbitrage' in self.docs:
   text=self.docs['tradfi_arbitrage'];chunks=[]
   for m in re.finditer(r'self\.__next_f\.push\((.*?)\)</script>',text):
    try:
     v=json.loads(m.group(1))
     if len(v)>1 and isinstance(v[1],str):chunks.append(v[1])
    except (ValueError,TypeError):pass
   stream=''.join(chunks);mark=stream.find('"spot":')
   try:
    if mark<0:raise ValueError('Public TradFi serialized data not found')
    spot=json.JSONDecoder().raw_decode(stream[mark+7:])[0]
   except (ValueError,TypeError):spot={}
   live=spot.get('live',{});rows=[]
   for r in live.get('rows',[]):
    ref=r.get('ref',{})
    # One flat entity row with quote columns preserves all 78 assets within 200 cap.
    z={'entity':r.get('base_asset'),'sector':r.get('sector'),'referenceVenue':ref.get('venue'),'referenceSymbol':ref.get('symbol'),'referencePrice':num(ref.get('last')),'referenceAsOf':iso(ref.get('asof_ms')),'referenceStale':r.get('ref_stale'),'sourceBestNetPremiumPct':num(r.get('best_net_premium_pct'))}
    for leg in r.get('legs',[]):
     prefix=leg.get('exchange','unknown')
     for out,key in [('Price','last'),('PremiumPct','premium_pct'),('SourceFundingRate','funding_rate')]:z[prefix+out]=num(leg.get(key))
     z[prefix+'Instrument']=leg.get('instrument');z[prefix+'AsOf']=iso(leg.get('asof_ms'))
    rows.append(z)
   measures=list(dict.fromkeys(k for r in rows for k,v in r.items() if isinstance(v,(int,float)) and not isinstance(v,bool)))
   self.add('tradfi_arbitrage','tradfi_arbitrage',rows,'snapshot','mixed',['entity','sector'],measures,'Yahoo参考价对永续快照；源代码映射与费率单位未独立核验。不把净边当可执行收益；各报价有自己的时点。未复制源研究文字。','pending' if not rows else 'stale' if iso(live.get('asof_ms')) and NOW-dt.datetime.fromisoformat(iso(live['asof_ms']).replace('Z','+00:00'))>dt.timedelta(days=1) else 'review',asof=iso(live.get('asof_ms')),coverage={'scheduleSeconds':live.get('schedule_sec'),'upstreamReference':live.get('source_ref')})
  for key,err in self.errors.items():
   aliases={'tradfi_deep':['tradfi_exchange_comparison'],'tradfi_stocks':['tradfi_stocks','tradfi_stock_assets','tradfi_stock_exchanges','tradfi_stock_oi_assets','tradfi_stock_oi_exchanges','tradfi_stock_funding']}
   for target in aliases.get(key,[key]):self.add(target,key,[],'unknown','unknown',[],[],str(err),'pending')
  self.add('cex_reserve_score','cex_reserves_daily',[],'research','score',[],[],'原作者手工研究评分未复制；栏目保留，待确认是否建立自有研究口径。','pending',title='储备可信度')
 def run(self):
  with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(self.fetch,PATHS.items()))
  self.normalize()
  # Contract checks guard against private/nested/raw payload accidentally leaking.
  ids=[]
  for d in self.datasets:
   ids.append(d['id']);assert len(d['rows'])<=1000
   assert all(not isinstance(v,(dict,list)) for row in d['rows'] for v in row.values())
   assert d['status'] in {'ready','stale','pending','review'}
   assert all(not isinstance(v,float) or math.isfinite(v) for row in d['rows'] for v in row.values())
  assert len(set(ids))==len(ids)
  payload={'datasets':self.datasets}
  self.out.mkdir(parents=True,exist_ok=True);tmp=self.out/'datasets.tmp';tmp.write_text(json.dumps(payload,ensure_ascii=False,indent=2,allow_nan=False));tmp.replace(self.out/'datasets.json')
  print(json.dumps({'datasets':len(self.datasets),'statusCounts':{s:sum(d['status']==s for d in self.datasets) for s in ['ready','stale','review','pending']},'errors':self.errors},ensure_ascii=False))

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output-dir',default=str(pathlib.Path(__file__).resolve().parent));parser.add_argument('--from-cache',action='store_true');args=parser.parse_args();Collector(args.output_dir,args.from_cache).run()
