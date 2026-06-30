PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`voting_power` integer DEFAULT 1 NOT NULL,
	`secret` integer DEFAULT false NOT NULL,
	`signature` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_votes`("id", "proposal_id", "user_id", "voting_power", "secret", "signature", "created_at", "updated_at") SELECT "id", "proposal_id", "user_id", "voting_power", "secret", "signature", "created_at", "updated_at" FROM `votes`;--> statement-breakpoint
DROP TABLE `votes`;--> statement-breakpoint
ALTER TABLE `__new_votes` RENAME TO `votes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `vote_unique_idx` ON `votes` (`proposal_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `vote_proposal_idx` ON `votes` (`proposal_id`);--> statement-breakpoint
CREATE INDEX `vote_user_idx` ON `votes` (`user_id`);--> statement-breakpoint
ALTER TABLE `proposals` DROP COLUMN `strategy_id`;