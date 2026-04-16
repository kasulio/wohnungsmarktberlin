CREATE TABLE `scraperRun` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`propertyManagementId` text,
	`success` integer NOT NULL,
	`statsJson` text NOT NULL,
	`errorMessage` text,
	`durationMs` integer,
	`trigger` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scraperRun_createdAt_idx` ON `scraperRun` (`createdAt`);