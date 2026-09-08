/**
 * Embedded, idempotent DDL — executed on boot by src/db/client.ts.
 * Source of truth: src/db/schema.ts (regenerate with `npm run db:generate`
 * and refresh this file). Embedding keeps the self-hosted image self-migrating
 * with no separate migrate step and no migration folder to ship.
 */
export const MIGRATION_STATEMENTS: string[] = [
  "CREATE TABLE IF NOT EXISTS `call_turns` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`call_id` text NOT NULL,\n\t`idx` integer NOT NULL,\n\t`speaker` text NOT NULL,\n\t`text` text NOT NULL,\n\t`analysis` text,\n\t`created_at` integer NOT NULL,\n\tFOREIGN KEY (`call_id`) REFERENCES `calls`(`id`) ON UPDATE no action ON DELETE cascade\n);",
  "CREATE TABLE IF NOT EXISTS `calls` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`drill_id` text NOT NULL,\n\t`rep_id` text NOT NULL,\n\t`status` text NOT NULL,\n\t`outcome` text,\n\t`patience` real NOT NULL,\n\t`trust` real DEFAULT 0 NOT NULL,\n\t`unlocked_fact_ids` text NOT NULL,\n\t`concession_log` text NOT NULL,\n\t`started_at` integer NOT NULL,\n\t`ended_at` integer,\n\tFOREIGN KEY (`drill_id`) REFERENCES `drills`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`rep_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action\n);",
  "CREATE TABLE IF NOT EXISTS `drill_assignments` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`drill_id` text NOT NULL,\n\t`rep_id` text NOT NULL,\n\t`created_at` integer NOT NULL,\n\tFOREIGN KEY (`drill_id`) REFERENCES `drills`(`id`) ON UPDATE no action ON DELETE cascade,\n\tFOREIGN KEY (`rep_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade\n);",
  "CREATE TABLE IF NOT EXISTS `drills` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`trainer_id` text NOT NULL,\n\t`prospect_id` text NOT NULL,\n\t`scorecard_id` text NOT NULL,\n\t`title` text NOT NULL,\n\t`briefing` text DEFAULT '' NOT NULL,\n\t`created_at` integer NOT NULL,\n\tFOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`prospect_id`) REFERENCES `prospects`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`scorecard_id`) REFERENCES `scorecards`(`id`) ON UPDATE no action ON DELETE no action\n);",
  "CREATE TABLE IF NOT EXISTS `hidden_facts` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`prospect_id` text NOT NULL,\n\t`label` text NOT NULL,\n\t`topic` text NOT NULL,\n\t`truth` text NOT NULL,\n\t`polite_lie` text NOT NULL,\n\t`unlock_rule` text NOT NULL,\n\t`sort_order` integer NOT NULL,\n\tFOREIGN KEY (`prospect_id`) REFERENCES `prospects`(`id`) ON UPDATE no action ON DELETE cascade\n);",
  "CREATE TABLE IF NOT EXISTS `invites` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`token` text NOT NULL,\n\t`role` text NOT NULL,\n\t`created_by` text NOT NULL,\n\t`used_by_user_id` text,\n\t`expires_at` integer NOT NULL,\n\t`created_at` integer NOT NULL,\n\tFOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`used_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action\n);",
  "CREATE UNIQUE INDEX IF NOT EXISTS `invites_token_unique` ON `invites` (`token`);",
  "CREATE TABLE IF NOT EXISTS `methodologies` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`trainer_id` text NOT NULL,\n\t`name` text NOT NULL,\n\t`description` text DEFAULT '' NOT NULL,\n\t`created_at` integer NOT NULL,\n\tFOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action\n);",
  "CREATE TABLE IF NOT EXISTS `methodology_entries` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`methodology_id` text NOT NULL,\n\t`number` text NOT NULL,\n\t`title` text NOT NULL,\n\t`text` text NOT NULL,\n\t`sort_order` integer NOT NULL,\n\tFOREIGN KEY (`methodology_id`) REFERENCES `methodologies`(`id`) ON UPDATE no action ON DELETE cascade\n);",
  "CREATE TABLE IF NOT EXISTS `prospects` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`trainer_id` text NOT NULL,\n\t`name` text NOT NULL,\n\t`job_title` text NOT NULL,\n\t`company` text NOT NULL,\n\t`persona` text NOT NULL,\n\t`deal_context` text DEFAULT '' NOT NULL,\n\t`opening_line` text NOT NULL,\n\t`patience_config` text NOT NULL,\n\t`concession_caps` text NOT NULL,\n\t`created_at` integer NOT NULL,\n\tFOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action\n);",
  "CREATE TABLE IF NOT EXISTS `reports` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`call_id` text NOT NULL,\n\t`status` text NOT NULL,\n\t`overall_score` real,\n\t`criteria_scores` text,\n\t`coaching_points` text,\n\t`dropped_points` text,\n\t`grader_model` text,\n\t`error` text,\n\t`created_at` integer NOT NULL,\n\t`grading_started_at` integer,\n\t`graded_at` integer,\n\tFOREIGN KEY (`call_id`) REFERENCES `calls`(`id`) ON UPDATE no action ON DELETE cascade\n);",
  "CREATE UNIQUE INDEX IF NOT EXISTS `reports_call_id_unique` ON `reports` (`call_id`);",
  "CREATE TABLE IF NOT EXISTS `scorecard_criteria` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`scorecard_id` text NOT NULL,\n\t`label` text NOT NULL,\n\t`description` text DEFAULT '' NOT NULL,\n\t`weight` real DEFAULT 1 NOT NULL,\n\t`methodology_entry_ids` text NOT NULL,\n\t`sort_order` integer NOT NULL,\n\tFOREIGN KEY (`scorecard_id`) REFERENCES `scorecards`(`id`) ON UPDATE no action ON DELETE cascade\n);",
  "CREATE TABLE IF NOT EXISTS `scorecards` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`trainer_id` text NOT NULL,\n\t`methodology_id` text NOT NULL,\n\t`name` text NOT NULL,\n\t`created_at` integer NOT NULL,\n\tFOREIGN KEY (`trainer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,\n\tFOREIGN KEY (`methodology_id`) REFERENCES `methodologies`(`id`) ON UPDATE no action ON DELETE no action\n);",
  "CREATE TABLE IF NOT EXISTS `sessions` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`user_id` text NOT NULL,\n\t`token_hash` text NOT NULL,\n\t`expires_at` integer NOT NULL,\n\t`created_at` integer NOT NULL,\n\tFOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade\n);",
  "CREATE UNIQUE INDEX IF NOT EXISTS `sessions_token_hash_unique` ON `sessions` (`token_hash`);",
  "CREATE TABLE IF NOT EXISTS `users` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`email` text NOT NULL,\n\t`name` text NOT NULL,\n\t`password_hash` text NOT NULL,\n\t`role` text NOT NULL,\n\t`created_at` integer NOT NULL\n);",
  "CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);",
  "CREATE TABLE IF NOT EXISTS `reviews` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`user_id` text NOT NULL,\n\t`channel` text NOT NULL,\n\t`stage` text DEFAULT 'cold' NOT NULL,\n\t`title` text NOT NULL,\n\t`raw_text` text NOT NULL,\n\t`turns` text NOT NULL,\n\t`scorecard_id` text NOT NULL,\n\t`status` text NOT NULL,\n\t`overall_score` real,\n\t`criteria_scores` text,\n\t`coaching_points` text,\n\t`dropped_points` text,\n\t`grader_model` text,\n\t`error` text,\n\t`created_at` integer NOT NULL,\n\t`grading_started_at` integer,\n\t`graded_at` integer,\n\tFOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,\n\tFOREIGN KEY (`scorecard_id`) REFERENCES `scorecards`(`id`) ON UPDATE no action ON DELETE no action\n);",
];

/**
 * Idempotent column additions for existing databases. SQLite has no
 * `ADD COLUMN IF NOT EXISTS`, so the client checks `PRAGMA table_info`
 * before applying each one.
 */
export const COLUMN_ADDITIONS: Array<{
  table: string;
  column: string;
  ddl: string;
}> = [
  {
    table: "drills",
    column: "channel",
    ddl: "ALTER TABLE `drills` ADD COLUMN `channel` text DEFAULT 'call' NOT NULL;",
  },
  {
    table: "calls",
    column: "channel_state",
    ddl: "ALTER TABLE `calls` ADD COLUMN `channel_state` text;",
  },
  {
    table: "calls",
    column: "reflections_earned",
    ddl: "ALTER TABLE `calls` ADD COLUMN `reflections_earned` integer DEFAULT 0 NOT NULL;",
  },
  {
    table: "call_turns",
    column: "meta",
    ddl: "ALTER TABLE `call_turns` ADD COLUMN `meta` text;",
  },
  {
    table: "reports",
    column: "grading_started_at",
    ddl: "ALTER TABLE `reports` ADD COLUMN `grading_started_at` integer;",
  },
  {
    table: "reviews",
    column: "grading_started_at",
    ddl: "ALTER TABLE `reviews` ADD COLUMN `grading_started_at` integer;",
  },
];
