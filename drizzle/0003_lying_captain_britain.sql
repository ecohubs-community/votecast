CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`community_id` text NOT NULL,
	`user_id` text,
	`proposal_id` text,
	`event` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`read_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`community_id`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notification_community_idx` ON `notifications` (`community_id`);--> statement-breakpoint
CREATE INDEX `notification_user_idx` ON `notifications` (`user_id`);