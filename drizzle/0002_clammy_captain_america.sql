CREATE TABLE `ballot_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`prompt` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ballot_question_proposal_idx` ON `ballot_questions` (`proposal_id`);--> statement-breakpoint
CREATE TABLE `proposal_types` (
	`id` text PRIMARY KEY NOT NULL,
	`community_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`overrides_allowed` integer DEFAULT true NOT NULL,
	`retired_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`community_id`) REFERENCES `communities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `proposal_type_community_idx` ON `proposal_types` (`community_id`);--> statement-breakpoint
CREATE TABLE `proposal_type_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`type_id` text NOT NULL,
	`version` integer NOT NULL,
	`method_snapshot_json` text NOT NULL,
	`deliberation_seconds` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`type_id`) REFERENCES `proposal_types`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proposal_type_version_unique_idx` ON `proposal_type_versions` (`type_id`,`version`);--> statement-breakpoint
CREATE INDEX `proposal_type_version_type_idx` ON `proposal_type_versions` (`type_id`);--> statement-breakpoint
CREATE TABLE `vote_selections` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`question_id` text,
	`choice_id` text,
	`rank` integer,
	`score` integer,
	`credits` integer,
	`consent_position` text,
	`reason` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`question_id`) REFERENCES `ballot_questions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`choice_id`) REFERENCES `proposal_choices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vote_selection_proposal_idx` ON `vote_selections` (`proposal_id`);--> statement-breakpoint
CREATE INDEX `vote_selection_user_idx` ON `vote_selections` (`user_id`);--> statement-breakpoint
CREATE INDEX `vote_selection_proposal_user_idx` ON `vote_selections` (`proposal_id`,`user_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`user_id` text NOT NULL,
	`choice_id` text,
	`voting_power` integer DEFAULT 1 NOT NULL,
	`secret` integer DEFAULT false NOT NULL,
	`metadata_json` text,
	`signature` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`choice_id`) REFERENCES `proposal_choices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_votes`("id", "proposal_id", "user_id", "choice_id", "voting_power", "secret", "metadata_json", "signature", "created_at", "updated_at") SELECT "id", "proposal_id", "user_id", "choice_id", "voting_power", false, "metadata_json", "signature", "created_at", "created_at" FROM `votes`;--> statement-breakpoint
DROP TABLE `votes`;--> statement-breakpoint
ALTER TABLE `__new_votes` RENAME TO `votes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `vote_unique_idx` ON `votes` (`proposal_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `vote_proposal_idx` ON `votes` (`proposal_id`);--> statement-breakpoint
CREATE INDEX `vote_user_idx` ON `votes` (`user_id`);--> statement-breakpoint
ALTER TABLE `proposals` ADD `type_version_id` text REFERENCES proposal_type_versions(id);--> statement-breakpoint
ALTER TABLE `proposals` ADD `method_override_json` text;--> statement-breakpoint
ALTER TABLE `proposals` ADD `phase` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `proposals` ADD `outcome` text;--> statement-breakpoint
CREATE INDEX `proposal_phase_idx` ON `proposals` (`phase`);--> statement-breakpoint
CREATE INDEX `proposal_type_version_idx` ON `proposals` (`type_version_id`);--> statement-breakpoint
ALTER TABLE `proposal_choices` ADD `question_id` text REFERENCES ballot_questions(id);--> statement-breakpoint
CREATE INDEX `proposal_choice_question_idx` ON `proposal_choices` (`question_id`);