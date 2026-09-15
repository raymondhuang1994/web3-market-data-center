import json,os,pathlib,subprocess,tempfile,unittest
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
   self.assertEqual(self.plan('schedule',{'schedule':cron}),(0,'phase='+phase+'\n'))
 def test_manual_phase_and_invalid_input(self):
  self.assertEqual(self.plan('workflow_dispatch',{'inputs':{'phase':'finalize'}}),(0,'phase=finalize\n'))
  self.assertNotEqual(self.plan('workflow_dispatch',{'inputs':{'phase':'unknown'}})[0],0)
if __name__=='__main__':unittest.main()
