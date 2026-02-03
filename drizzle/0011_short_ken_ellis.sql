CREATE TABLE `flatUrl` (
	`url` text NOT NULL,
	`propertyManagementId` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`createdAt` integer NOT NULL
);
