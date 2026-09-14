import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const snapshots = sqliteTable('snapshots', {
  id: text('id').primaryKey(),
  generatedAt: text('generated_at').notNull(),
  receivedAt: text('received_at').notNull(),
  runId: text('run_id').notNull(),
  payloadHash: text('payload_hash').notNull(),
});
export const datasets = sqliteTable('datasets', {
  key: text('key').primaryKey(),
  snapshotId: text('snapshot_id').notNull(),
  datasetId: text('dataset_id').notNull(),
  payload: text('payload').notNull(),
});
export const current = sqliteTable('current_snapshot', {
  id: integer('id').primaryKey(),
  snapshotId: text('snapshot_id').notNull(),
  generatedAt: text('generated_at').notNull(),
});
export const tokens = sqliteTable('ingest_tokens', {
  jti: text('jti').primaryKey(),
  payloadHash: text('payload_hash').notNull(),
  snapshotId: text('snapshot_id').notNull(),
  acceptedAt: text('accepted_at').notNull(),
});
