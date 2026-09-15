#!/usr/bin/env python3
import datetime,json,os,pathlib,subprocess,re
mode='collect'
if os.environ.get('GITHUB_EVENT_NAME')=='schedule':
    event=json.loads(pathlib.Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    if event.get('schedule') in ('7 1 * * *','32 1 * * *'):mode='finalize'
if os.environ.get('GITHUB_EVENT_NAME')=='workflow_dispatch':
    event=json.loads(pathlib.Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    mode=event.get('inputs',{}).get('phase','collect')
elif os.environ.get('GITHUB_EVENT_NAME')=='push':
    now=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))
    date=now.date().isoformat()
    event=json.loads(pathlib.Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    before,after=event.get('before',''),event.get('after','')
    if not re.fullmatch(r'[0-9a-f]{40}',before) or not re.fullmatch(r'[0-9a-f]{40}',after) or before=='0'*40:raise RuntimeError('Invalid push range')
    files=subprocess.check_output(['git','diff','--name-only',before,after],text=True).splitlines()
    if f'data/analysis/{date}.json' in files:mode='finalize'
    elif f'data/requests/{date}.json' in files and now.hour>=9:mode='finalize'
if mode not in ('collect','finalize'):raise RuntimeError('Unknown workflow phase')
with open(os.environ['GITHUB_OUTPUT'],'a') as out:out.write('phase='+mode+'\n')
print('Daily workflow phase: '+mode)
