CREATE TABLE `reports` (
	`snapshot_id` text PRIMARY KEY NOT NULL,
	`object_key` text NOT NULL,
	`pdf_hash` text NOT NULL,
	`byte_count` integer NOT NULL,
	`data_generated_at` text NOT NULL,
	`created_at` text NOT NULL,
	`run_id` text NOT NULL
);
