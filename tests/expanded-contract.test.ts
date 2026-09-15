import test from 'node:test';
import assert from 'node:assert/strict';
import baseline from '../lib/bootstrap.ts';
import { validateBundle, validatePerpSample, keepLastGood } from '../lib/snapshot.ts';
import type { Dataset } from '../lib/data.ts';
const names=['Hyperliquid (Core + HIP-3)','dYdX v4','Lighter'];
function sample(date='2026-09-15'): Dataset {
  const d=structuredClone(baseline.datasets.find(d=>d.id==='dex_perp_market_share')!);
  d.rows=names.map((entity,i)=>({date,entity,value:i?25:50,volumeNominal:i?50:100,cohortVersion:'hl-core-hip3_dydx-v4_lighter-eth-v1'}));
  d.asOf=date;return d;
}
void test('approved registry preserves original columns and authorizes only declared source contracts',()=>{
  assert.equal(baseline.datasets.length,215);
  const b=structuredClone(baseline);b.generatedAt=new Date().toISOString();
  validateBundle(b,baseline);
  const d=b.datasets.find(d=>d.id==='stock_token_registry')!;
  d.rows=[{entity:'AAPL',chainId:4663}];d.measures=['chainId'];
  validateBundle(b,baseline);
  d.source.url='https://example.com/other';assert.throws(()=>validateBundle(b,baseline));
});
void test('fixed sample rejects missing protocols, wrong weights, and unknown cohort versions',()=>{
  validatePerpSample(sample());
  for (const mutate of [(d:Dataset)=>d.rows.pop(),(d:Dataset)=>{d.rows[0].value=99},(d:Dataset)=>{d.rows[0].cohortVersion='other'}]){
    const d=sample();mutate(d);assert.throws(()=>validatePerpSample(d));
  }
});
void test('sample daily history preserves complete old cohorts and replaces same-day observations',()=>{
  const before={schemaVersion:1,generatedAt:'2026-09-14T00:50:00Z',datasets:[sample('2026-09-14')]};
  const after={...before,generatedAt:'2026-09-15T00:50:00Z',datasets:[sample()]};
  const saved=keepLastGood(after,before);
  assert.equal(saved.datasets[0].rows.length,6);
  assert.equal(keepLastGood(after,saved).datasets[0].rows.length,6);
  const failed={...after,datasets:[{...sample(),rows:[]}]};
  assert.equal(keepLastGood(failed,saved).datasets[0].rows.length,6);
});
