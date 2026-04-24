CREATE TABLE `users` (
	`group_id` text PRIMARY KEY NOT NULL,
	`current_stage` text DEFAULT 'START' NOT NULL,
	`state_version` integer DEFAULT 0 NOT NULL,
	`q1_order` text,
	`current_unlocked_subquestion` text,
	`q1_1_completed` integer DEFAULT 0 NOT NULL,
	`q1_2_completed` integer DEFAULT 0 NOT NULL,
	`q2_completed` integer DEFAULT 0 NOT NULL,
	`q3_keyword_completed` integer DEFAULT 0 NOT NULL,
	`q3_code_completed` integer DEFAULT 0 NOT NULL,
	`q4_completed` integer DEFAULT 0 NOT NULL,
	`reported` integer DEFAULT 0 NOT NULL,
	`started_at` text,
	`completed_at` text,
	`reported_at` text,
	`epilogue_viewed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_users_updated_at` ON `users` (`updated_at`);--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`group_id` text NOT NULL,
	`api_name` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`response_json` text NOT NULL,
	`status_code` integer NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`group_id`, `api_name`, `idempotency_key`)
);
--> statement-breakpoint
CREATE INDEX `idx_idempotency_expires` ON `idempotency_keys` (`expires_at`);--> statement-breakpoint
CREATE TABLE `operator_credentials` (
	`operator_id` text PRIMARY KEY NOT NULL,
	`password_hash_b64` text NOT NULL,
	`password_salt_b64` text NOT NULL,
	`password_iterations` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operator_session_events` (
	`id` text PRIMARY KEY NOT NULL,
	`operator_id` text NOT NULL,
	`session_id` text NOT NULL,
	`event_type` text NOT NULL,
	`ip_address` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_operator_session_events_created_at` ON `operator_session_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `operator_sessions` (
	`session_id` text PRIMARY KEY NOT NULL,
	`operator_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_operator_sessions_expires` ON `operator_sessions` (`expires_at`);--> statement-breakpoint
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
CREATE INDEX `idx_attempt_logs_created_at` ON `attempt_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_attempt_logs_group_stage` ON `attempt_logs` (`group_id`,`stage`);--> statement-breakpoint
CREATE TABLE `hint_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`stage` text NOT NULL,
	`user_message` text NOT NULL,
	`assistant_message` text NOT NULL,
	`hint_level` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_hint_logs_created_at` ON `hint_logs` (`created_at`);--> statement-breakpoint
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
--> statement-breakpoint
CREATE INDEX `idx_operator_actions_created_at` ON `operator_actions` (`created_at`);--> statement-breakpoint
CREATE TABLE `user_progress_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`event_type` text NOT NULL,
	`from_stage` text,
	`to_stage` text,
	`detail` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_user_progress_logs_created_at` ON `user_progress_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_user_progress_logs_group` ON `user_progress_logs` (`group_id`);--> statement-breakpoint
CREATE TABLE `checkpoint_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`stage` text NOT NULL,
	`label` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
