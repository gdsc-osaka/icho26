ALTER TABLE `users` ADD `is_deleted` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_users_is_deleted` ON `users` (`is_deleted`);