CREATE TABLE `daily_editions` (
	`snapshot_id` text PRIMARY KEY NOT NULL,
	`report_date` text NOT NULL,
	`cutoff_at` text NOT NULL,
	`deadline_at` text NOT NULL,
	`calendar_json` text NOT NULL,
	`analysis_json` text,
	`analysis_hash` text,
	`finalizer_run_id` text,
	`published_at` text
);
