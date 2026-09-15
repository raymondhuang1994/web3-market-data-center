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
export const reports = sqliteTable('reports', {
  snapshotId: text('snapshot_id').primaryKey(),
  objectKey: text('object_key').notNull(),
  pdfHash: text('pdf_hash').notNull(),
  byteCount: integer('byte_count').notNull(),
  dataGeneratedAt: text('data_generated_at').notNull(),
  createdAt: text('created_at').notNull(),
  runId: text('run_id').notNull(),
});
export const archives = sqliteTable('snapshot_archives', {
  snapshotId: text('snapshot_id').primaryKey(),
  archivedAt: text('archived_at').notNull(),
});
export const editions = sqliteTable('daily_editions', {
  snapshotId: text('snapshot_id').primaryKey(),
  reportDate: text('report_date').notNull(),
  cutoffAt: text('cutoff_at').notNull(),
  deadlineAt: text('deadline_at').notNull(),
  calendarJson: text('calendar_json').notNull(),
  analysisJson: text('analysis_json'),
  analysisHash: text('analysis_hash'),
  finalizerRunId: text('finalizer_run_id'),
  publishedAt: text('published_at'),
});
