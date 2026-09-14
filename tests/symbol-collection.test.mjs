import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('asset history reports partial request failures and records request times', () => {
  const run = spawnSync('python3', ['-c', `
import importlib.util,pathlib
spec=importlib.util.spec_from_file_location('collector','scripts/fetch_decentralized.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
c.now=lambda:'2026-09-15T01:00:00Z'
def fake_fetch(root,key,url,offline=False):
    c.ATTEMPTS[url]='2026-09-15T01:00:00Z'
    return {'data':[{'date':'2026-09-13','volume':10,'oi':20}]},'2026-09-15T01:00:01Z',('source timeout' if 'BBB' in url else None)
c.fetch=fake_fetch
d=c.symbol_series_dataset(pathlib.Path('.'),{'rows':[{'symbol':'AAA','value':2},{'symbol':'BBB','value':1}]},False)
assert len(d['rows'])==2
assert d['collection']['result']=='failed'
assert 'BBB: source timeout' in d['collection']['error']
assert d['collection']['attemptedAt']<d['fetchedAt']
assert [r['result'] for r in d['coverage']['requests']]==['ok','failed']
assert d['coverage']['refreshErrors']==['BBB: source timeout']
`], { encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  assert.equal(run.status, 0, run.stderr);
});
