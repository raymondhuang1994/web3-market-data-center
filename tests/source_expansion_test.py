import datetime as dt, pathlib, sys, unittest
from unittest.mock import patch
import subprocess
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from fetch_official import settled_days,zscores
from fetch_expansion import normalize_sector
from fetch_perps import shares,total,PROTOCOLS
import collect

class Sources(unittest.TestCase):
 def test_collector_failure_is_isolated(self):
  with patch.object(collect.subprocess,'run',side_effect=subprocess.TimeoutExpired('collector',720)):
   self.assertEqual(collect.run(['source.py']),124)
  with patch.object(collect.subprocess,'run',side_effect=OSError('unavailable')):
   self.assertEqual(collect.run(['source.py']),124)
 def test_fixed_sample(self):
  weights,denominator=shares(dict(zip(PROTOCOLS,[100,50,50])))
  self.assertEqual(list(weights.values()),[50,25,25])
  for bad in [{PROTOCOLS[0]:1},dict(zip(PROTOCOLS,[0,0,0])),dict(zip(PROTOCOLS,[1,None,2]))]:
   with self.assertRaises((ValueError,TypeError)):shares(bad)
  for value in [True,-1,float('nan'),float('inf'),None]:
   with self.assertRaises((ValueError,TypeError)):total([('market',value)])
  with self.assertRaises(ValueError):total([('same',1),('same',2)])
 def test_zscore_contiguous_and_no_future_leak(self):
  start=dt.date(2026,1,1)
  rows=[{'date':(start+dt.timedelta(days=i)).isoformat(),'value':i/10000} for i in range(100)]
  values=zscores(rows)
  self.assertTrue(all(r['value'] is None for r in values[:89]))
  self.assertIsNotNone(values[89]['value'])
  self.assertEqual(zscores(rows[:95]),values[:95])
  scaled=zscores([{**r,'value':r['value']*100} for r in rows])
  self.assertAlmostEqual(scaled[-1]['value'],values[-1]['value'])
  missing=zscores(rows[:50]+rows[51:])
  self.assertIsNone(missing[-1]['value'])
  self.assertTrue(all(r['value'] is None for r in zscores([{**r,'value':1} for r in rows])))
  with self.assertRaises(ValueError):zscores(rows+rows[-1:])
 def test_settlement_sort_missing_and_current_day(self):
  start=int(dt.datetime(2026,1,1,tzinfo=dt.timezone.utc).timestamp()*1000)
  rows=[{'calc_time':start+i*8*3600000,'last_funding_rate':'0.0001','funding_interval_hours':8} for i in range(6)]
  result=settled_days(list(reversed(rows)),'2026-01-02')
  self.assertEqual(len(result),1);self.assertAlmostEqual(result[0]['value'],0.0003)
  self.assertEqual(settled_days(rows[:1]+rows[2:],'2026-01-02'),[])
  with self.assertRaises(ValueError):settled_days(rows+rows[:1],'2026-01-03')
 def test_sector_identity_nulls_and_unfinished_day(self):
  t=lambda s:int(dt.datetime.fromisoformat(s).replace(tzinfo=dt.timezone.utc).timestamp()*1000)
  payload={'code':'0','data':{'selected_label':'AI','categories':[{'name':'AI','points':[{'time':t('2026-01-01'),'value':10},{'time':t('2026-01-02'),'value':99}]}]}}
  result=normalize_sector('AI',payload,'2026-01-02T00:01:00Z',today='2026-01-02')
  self.assertEqual(result[0]['rows'],[{'date':'2026-01-01','AI':10}])
  self.assertEqual(result[-1]['rows'],[])
  self.assertTrue(all(not d['rows'] for d in normalize_sector('Wrong',payload,'2026-01-02T00:01:00Z')))
if __name__=='__main__':unittest.main()
