PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_flat` (
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
	`propertyManagementId` text,
	`firstSeen` integer NOT NULL,
	`lastSeen` integer NOT NULL,
	`deleted` integer,
	`url` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_flat`("id", "title", "coldRentPrice", "warmRentPrice", "roomCount", "usableArea", "floor", "image", "addressId", "addressText", "propertyManagementId", "firstSeen", "lastSeen", "deleted", "url") SELECT "id", "title", "coldRentPrice", "warmRentPrice", "roomCount", "usableArea", "floor", "image", "addressId", "addressText", "propertyManagementId", "firstSeen", "lastSeen", "deleted", "url" FROM `flat`;--> statement-breakpoint
DROP TABLE `flat`;--> statement-breakpoint
ALTER TABLE `__new_flat` RENAME TO `flat`;--> statement-breakpoint
PRAGMA foreign_keys=ON;