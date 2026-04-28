CREATE TABLE `users` (
	`group_id` text PRIMARY KEY NOT NULL,
	`current_stage` text NOT NULL,
	`q1_order` text,
	`q1_1_cleared` integer DEFAULT 0 NOT NULL,
	`q1_2_cleared` integer DEFAULT 0 NOT NULL,
	`q2_cleared` integer DEFAULT 0 NOT NULL,
	`started_at` text,
	`completed_at` text,
	`reported_at` text,
	`epilogue_viewed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_users_updated_at` ON `users` (`updated_at`);--> statement-breakpoint
CREATE TABLE `attempt_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`stage` text NOT NULL,
	`raw_input` text NOT NULL,
	`normalized_input` text NOT NULL,
	`correct` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_attempt_logs_group_stage` ON `attempt_logs` (`group_id`,`stage`);--> statement-breakpoint
CREATE TABLE `progress_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`event_type` text NOT NULL,
	`from_stage` text,
	`to_stage` text,
	`detail` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_progress_logs_group` ON `progress_logs` (`group_id`);--> statement-breakpoint
CREATE TABLE `checkpoint_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`stage` text NOT NULL,
	`label` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operator_credentials` (
	`operator_id` text PRIMARY KEY NOT NULL,
	`password_hash_b64` text NOT NULL,
	`password_salt_b64` text NOT NULL,
	`password_iterations` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operator_sessions` (
	`session_id` text PRIMARY KEY NOT NULL,
	`operator_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_operator_sessions_expires` ON `operator_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `operator_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`operator_id` text NOT NULL,
	`group_id` text NOT NULL,
	`action_type` text NOT NULL,
	`from_stage` text,
	`to_stage` text,
	`reason_code` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL
);
