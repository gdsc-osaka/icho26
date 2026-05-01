ALTER TABLE `users` ADD `reserved_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `admitted_at` text;--> statement-breakpoint
CREATE INDEX `idx_users_reserved_at` ON `users` (`reserved_at`);