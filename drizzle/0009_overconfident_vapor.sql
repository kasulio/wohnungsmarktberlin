CREATE TABLE `telegramLinkToken` (
	`token` text PRIMARY KEY NOT NULL,
	`filterJson` text,
	`createdAt` integer NOT NULL
);
