import contextlib,io,json,pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'scripts'))
from oidc_post import publication_error,PublishError
from analysis_retry import generate_with_retry

class RetryTest(unittest.TestCase):
 def simulate(self,errors):
  elapsed=[0];calls=[];waits=[]
  def action():
   calls.append(1)
   if errors:raise errors.pop(0)
   return {'accepted':True}
  def sleep(seconds):waits.append(seconds);elapsed[0]+=seconds
  output=io.StringIO()
  with contextlib.redirect_stdout(output):
   try:result=generate_with_retry(action,clock=lambda:elapsed[0],sleep=sleep,jitter=lambda:0)
   except PublishError as error:result=error
  return result,len(calls),waits,output.getvalue()
 def test_retry_after_then_success(self):
  result,calls,waits,_=self.simulate([PublishError(503,'bigmodel_platform_overloaded',True,120)])
  self.assertEqual(result,{'accepted':True});self.assertEqual(calls,2);self.assertEqual(waits,[120])
 def test_permanent_or_long_wait_never_retries_early(self):
  for error in [PublishError(422,'bigmodel_quota_exhausted'),PublishError(503,'bigmodel_http_429',True,7200)]:
   result,calls,waits,_=self.simulate([error]);self.assertIs(result,error);self.assertEqual(calls,1);self.assertEqual(waits,[])
 def test_bounded_attempts_and_safe_diagnostics(self):
  error=PublishError(503,'bigmodel_http_429',True)
  result,calls,waits,_=self.simulate([error]*10)
  self.assertEqual(calls,4);self.assertEqual(waits,[60,120,240])
  for raw in [b'private account secret',json.dumps({'error':'private account secret','retryAfterSeconds':-10}).encode()]:
   e=publication_error(503,raw);self.assertNotIn('secret',str(e));self.assertIsNone(e.retry_after)
  blocked=publication_error(422,b'{"error":"bigmodel_quota_exhausted","retryable":false}')
  self.assertFalse(blocked.retryable)
 def test_edge_retry_after_without_json_is_preserved(self):
  e=publication_error(503,b'<html>private account secret</html>','7200')
  self.assertEqual(e.retry_after,7200)
  _,calls,waits,_=self.simulate([e]);self.assertEqual(calls,1);self.assertEqual(waits,[])
  e=publication_error(503,b'{"retryAfterSeconds":120}','300')
  self.assertEqual(e.retry_after,300)
 def test_budget_includes_oidc_and_publish_time(self):
  elapsed=[0];calls=[]
  def action():
   calls.append(1);elapsed[0]+=150
   raise PublishError(503,'bigmodel_http_429',True)
  def sleep(seconds):elapsed[0]+=seconds
  with contextlib.redirect_stdout(io.StringIO()),self.assertRaises(PublishError):
   generate_with_retry(action,clock=lambda:elapsed[0],sleep=sleep,jitter=lambda:0)
  self.assertEqual(len(calls),2);self.assertLessEqual(elapsed[0],600)
if __name__=='__main__':unittest.main()
