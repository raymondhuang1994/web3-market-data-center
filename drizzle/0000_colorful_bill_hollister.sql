CREATE TABLE `current_snapshot` (
	`id` integer PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`generated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `datasets` (
	`key` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`dataset_id` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`generated_at` text NOT NULL,
	`received_at` text NOT NULL,
	`run_id` text NOT NULL,
	`payload_hash` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingest_tokens` (
	`jti` text PRIMARY KEY NOT NULL,
	`payload_hash` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`accepted_at` text NOT NULL
);
