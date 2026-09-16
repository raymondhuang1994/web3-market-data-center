import datetime,json,os,pathlib,subprocess,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class ScheduleTest(unittest.TestCase):
 def plan(self,event_name,event):
  with tempfile.TemporaryDirectory() as tmp:
   event_path=pathlib.Path(tmp)/'event.json';event_path.write_text(json.dumps(event));out=pathlib.Path(tmp)/'out'
   env={**os.environ,'GITHUB_EVENT_NAME':event_name,'GITHUB_EVENT_PATH':str(event_path),'GITHUB_OUTPUT':str(out)}
   result=subprocess.run(['python3',str(ROOT/'scripts/workflow-plan.py')],env=env,capture_output=True,text=True)
   return result.returncode,out.read_text() if out.exists() else ''
 def test_daily_schedule_phases(self):
  for cron,phase in [('37 0 * * *','collect'),('52 0 * * *','collect'),('7 1 * * *','finalize'),('32 1 * * *','finalize')]:
   expected='finalize' if datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).hour>=9 else phase
   self.assertEqual(self.plan('schedule',{'schedule':cron}),(0,'phase='+expected+'\n'))
 def test_manual_phase_and_invalid_input(self):
  self.assertEqual(self.plan('workflow_dispatch',{'inputs':{'phase':'finalize'}}),(0,'phase=finalize\n'))
  self.assertNotEqual(self.plan('workflow_dispatch',{'inputs':{'phase':'unknown'}})[0],0)
 def test_cutoff_includes_weekends_and_holidays(self):
  source=(ROOT/'scripts/workflow-plan.py').read_text().split('now=datetime.datetime.now',1)[0]
  namespace={};exec(source,namespace)
  for date in ['2026-09-16','2026-09-19','2026-10-01']:
   for clock,expected in [('08:59:59','collect'),('09:00:00','finalize'),('14:00:00','finalize')]:
    now=datetime.datetime.fromisoformat(date+'T'+clock+'+08:00')
    self.assertEqual(namespace['cutoff_phase']('collect',now),expected)
if __name__=='__main__':unittest.main()
