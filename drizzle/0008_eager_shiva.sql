CREATE TABLE `notificationSent` (
	`subscriberId` text NOT NULL,
	`flatId` text NOT NULL,
	`sentAt` integer NOT NULL,
	PRIMARY KEY(`subscriberId`, `flatId`)
);
--> statement-breakpoint
CREATE TABLE `notificationSubscriber` (
	`id` text PRIMARY KEY NOT NULL,
	`channel` text NOT NULL,
	`target` text NOT NULL,
	`filterJson` text,
	`active` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `flat` ADD `firstPublishableAt` integer;--> statement-breakpoint
--> Backfill: existing publishable inventory counts as "already published in the
--> past" (migration timestamp) so subscribers are never blasted with the backlog.
UPDATE `flat`
SET `firstPublishableAt` = strftime('%s', 'now')
WHERE `firstPublishableAt` IS NULL
	AND `deleted` IS NULL
	AND `addressId` IS NOT NULL
	AND `ignored` = 0;