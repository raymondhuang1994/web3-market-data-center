import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { freezeAnalysis } from '../lib/analysis-publish.ts';
import { sha256 } from '../lib/oidc.ts';
import type { Bundle } from '../lib/data.ts';
import type { Analysis } from '../lib/analysis.ts';
function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(`CREATE TABLE ingest_tokens(jti TEXT PRIMARY KEY,payload_hash TEXT,snapshot_id TEXT,accepted_at TEXT);
  CREATE TABLE daily_editions(snapshot_id TEXT PRIMARY KEY,analysis_json TEXT,analysis_hash TEXT,finalizer_run_id TEXT,published_at TEXT);
  INSERT INTO daily_editions(snapshot_id) VALUES('snapshot');`);
  const database = {
    prepare(query: string) {
      const stmt = sql.prepare(query);
      let values: SQLInputValue[] = [];
      return {
        bind(...args: SQLInputValue[]) {
          values = args;
          return this;
        },
        async first() {
          return stmt.get(...values) || null;
        },
        run() {
          const result = stmt.run(...values);
          return { meta: { changes: Number(result.changes) } };
        },
      };
    },
    async batch(statements: { run: () => unknown }[]) {
      sql.exec('BEGIN');
      try {
        const results = statements.map((s) => s.run());
        sql.exec('COMMIT');
        return results;
      } catch (e) {
        sql.exec('ROLLBACK');
        throw e;
      }
    },
  } as unknown as D1Database;
  const bundle = {
    snapshotId: 'snapshot',
    generatedAt: '2026-09-15T00:52:00Z',
    edition: { reportDate: '2026-09-15' },
  } as Bundle;
  const analysis = {
    version: 1,
    producer: 'BigModel',
    model: 'glm-4.7-flash',
    generatedAt: '2026-09-15T01:07:00Z',
    points: [],
    facts: [],
  } as unknown as Analysis;
  return { sql, database, bundle, analysis };
}
void test('freeze and retry preserve exact AI text while granting current PDF finalizer', async () => {
  const { sql, database, bundle, analysis } = fixture();
  try {
    const first = await freezeAnalysis(
      bundle,
      analysis,
      { jti: 'one', run_id: '10' },
      'payload',
      database,
    );
    assert.equal(first.status, 200);
    const result = (await first.json()) as { analysisHash: string };
    bundle.edition!.analysisHash = result.analysisHash;
    const stored = sql
      .prepare('SELECT analysis_json FROM daily_editions')
      .get()!.analysis_json;
    assert.equal(
      (
        await freezeAnalysis(
          bundle,
          analysis,
          { jti: 'two', run_id: '11' },
          'payload',
          database,
        )
      ).status,
      200,
    );
    const row = sql.prepare('SELECT * FROM daily_editions').get()!;
    assert.equal(row.analysis_json, stored);
    assert.equal(row.finalizer_run_id, '11');
    assert.equal(
      (
        await freezeAnalysis(
          bundle,
          { ...analysis, generatedAt: '2026-09-15T01:32:00Z' },
          { jti: 'three', run_id: '12' },
          'payload',
          database,
        )
      ).status,
      409,
    );
  } finally {
    sql.close();
  }
});
void test('replayed older finalizer never receives a false accepted receipt', async () => {
  const { sql, database, bundle, analysis } = fixture();
  try {
    await freezeAnalysis(
      bundle,
      analysis,
      { jti: 'one', run_id: '10' },
      'payload',
      database,
    );
    await freezeAnalysis(
      bundle,
      analysis,
      { jti: 'two', run_id: '11' },
      'payload',
      database,
    );
    assert.equal(
      (
        await freezeAnalysis(
          bundle,
          analysis,
          { jti: 'one', run_id: '10' },
          'payload',
          database,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await freezeAnalysis(
          bundle,
          analysis,
          { jti: 'two', run_id: '11' },
          'changed',
          database,
        )
      ).status,
      409,
    );
  } finally {
    sql.close();
  }
});
void test('published editions remain immutable and report their actual published state', async () => {
  const { sql, database, bundle, analysis } = fixture();
  try {
    const hash = await sha256(
      new TextEncoder().encode(JSON.stringify(analysis)),
    );
    sql
      .prepare(
        'UPDATE daily_editions SET analysis_json=?,analysis_hash=?,finalizer_run_id=?,published_at=?',
      )
      .run(JSON.stringify(analysis), hash, '10', '2026-09-15T01:15:00Z');
    bundle.edition!.publishedAt = '2026-09-15T01:15:00Z';
    bundle.edition!.analysisHash = hash;
    const response = await freezeAnalysis(
      bundle,
      analysis,
      { jti: 'later', run_id: '12' },
      'payload',
      database,
    );
    assert.equal(response.status, 200);
    assert.equal(((await response.json()) as { published: boolean }).published, true);
    assert.equal(
      sql.prepare('SELECT finalizer_run_id FROM daily_editions').get()!
        .finalizer_run_id,
      '10',
    );
  } finally {
    sql.close();
  }
});
