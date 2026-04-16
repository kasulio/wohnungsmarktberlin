ALTER TABLE `flatUrlJob` ADD `lastError` text;--> statement-breakpoint
ALTER TABLE `flatUrlJob` ADD `attempts` integer DEFAULT 0 NOT NULL;