PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_flatUrlJob` (
	`url` text PRIMARY KEY NOT NULL,
	`propertyManagementId` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_flatUrlJob`("url", "propertyManagementId", "status", "createdAt") SELECT "url", "propertyManagementId", "status", "createdAt" FROM `flatUrlJob`;--> statement-breakpoint
DROP TABLE `flatUrlJob`;--> statement-breakpoint
ALTER TABLE `__new_flatUrlJob` RENAME TO `flatUrlJob`;--> statement-breakpoint
PRAGMA foreign_keys=ON;