CREATE TABLE `address` (
	`id` text PRIMARY KEY NOT NULL,
	`street` text NOT NULL,
	`city` text NOT NULL,
	`streetNumber` text NOT NULL,
	`postalCode` text NOT NULL,
	`longitude` real,
	`latitude` real
);
--> statement-breakpoint
CREATE TABLE `flat` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`coldRentPrice` integer,
	`warmRentPrice` integer,
	`roomCount` integer,
	`usableArea` real,
	`floor` integer,
	`image` blob,
	`addressId` text,
	`addressText` text DEFAULT '' NOT NULL,
	`addressImprovement` text DEFAULT 'pending',
	`propertyManagementId` text,
	`firstSeen` integer NOT NULL,
	`lastSeen` integer NOT NULL,
	`deleted` integer,
	`url` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `flatToTag` (
	`flatId` text NOT NULL,
	`tagId` text NOT NULL,
	PRIMARY KEY(`flatId`, `tagId`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `flatToTag_flatId_tagId_unique` ON `flatToTag` (`flatId`,`tagId`);--> statement-breakpoint
CREATE TABLE `flatUrlJob` (
	`url` text PRIMARY KEY NOT NULL,
	`propertyManagementId` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `propertyManagement` (
	`slug` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`website` text
);
--> statement-breakpoint
CREATE TABLE `signups` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`createdAt` integer NOT NULL,
	`districts` text,
	`maxPrice` integer NOT NULL,
	`minRooms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tag` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
