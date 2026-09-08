CREATE TABLE `call_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`call_id` text NOT NULL,
	`idx` integer NOT NULL,
	`speaker` text NOT NULL,
	`text` text NOT NULL,
	`analysis` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`call_id`) REFERENCES `calls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `calls` (
	`id` text PRIMARY KEY NOT NULL,
	`drill_id` text NOT NULL,
	`rep_id` text NOT NULL,
	`status` text NOT NULL,
	`outcome` text,
	`patience` real NOT NULL,
	`trust` real DEFAULT 0 NOT NULL,
	`unlocked_fact_ids` text NOT NULL,
	`concession_log` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`drill_id`) REFERENCES `drills`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rep_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `drill_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`drill_id` text NOT NULL,
	`rep_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`drill_id`) REFERENCES `drills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rep_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `drills` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`prospect_id` text NOT NULL,
	`scorecard_id` text NOT NULL,
	`title` text NOT NULL,
	`briefing` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prospect_id`) REFERENCES `prospects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scorecard_id`) REFERENCES `scorecards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `hidden_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`prospect_id` text NOT NULL,
	`label` text NOT NULL,
	`topic` text NOT NULL,
	`truth` text NOT NULL,
	`polite_lie` text NOT NULL,
	`unlock_rule` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`prospect_id`) REFERENCES `prospects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`role` text NOT NULL,
	`created_by` text NOT NULL,
	`used_by_user_id` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`used_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_token_unique` ON `invites` (`token`);--> statement-breakpoint
CREATE TABLE `methodologies` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `methodology_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`methodology_id` text NOT NULL,
	`number` text NOT NULL,
	`title` text NOT NULL,
	`text` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`methodology_id`) REFERENCES `methodologies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `prospects` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`name` text NOT NULL,
	`job_title` text NOT NULL,
	`company` text NOT NULL,
	`persona` text NOT NULL,
	`deal_context` text DEFAULT '' NOT NULL,
	`opening_line` text NOT NULL,
	`patience_config` text NOT NULL,
	`concession_caps` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`call_id` text NOT NULL,
	`status` text NOT NULL,
	`overall_score` real,
	`criteria_scores` text,
	`coaching_points` text,
	`dropped_points` text,
	`grader_model` text,
	`error` text,
	`created_at` integer NOT NULL,
	`graded_at` integer,
	FOREIGN KEY (`call_id`) REFERENCES `calls`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reports_call_id_unique` ON `reports` (`call_id`);--> statement-breakpoint
CREATE TABLE `scorecard_criteria` (
	`id` text PRIMARY KEY NOT NULL,
	`scorecard_id` text NOT NULL,
	`label` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`weight` real DEFAULT 1 NOT NULL,
	`methodology_entry_ids` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`scorecard_id`) REFERENCES `scorecards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scorecards` (
	`id` text PRIMARY KEY NOT NULL,
	`trainer_id` text NOT NULL,
	`methodology_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`methodology_id`) REFERENCES `methodologies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);