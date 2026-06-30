ALTER TABLE `proposals` ADD `rationale` text;--> statement-breakpoint
ALTER TABLE `proposal_type_versions` ADD `voting_seconds` integer DEFAULT 259200 NOT NULL;--> statement-breakpoint
ALTER TABLE `proposal_type_versions` ADD `default_choices_json` text;--> statement-breakpoint
ALTER TABLE `proposal_type_versions` ADD `default_visibility` text DEFAULT 'community' NOT NULL;--> statement-breakpoint
ALTER TABLE `proposal_type_versions` ADD `lock_choices` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `proposal_type_versions` ADD `lock_deliberation` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `proposal_type_versions` ADD `lock_voting` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `proposal_type_versions` ADD `lock_visibility` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `proposal_type_versions` ADD `question_contributors` text DEFAULT 'proposer' NOT NULL;--> statement-breakpoint
ALTER TABLE `proposal_type_versions` ADD `question_contribution_phase` text DEFAULT 'creation' NOT NULL;--> statement-breakpoint
ALTER TABLE `proposal_type_versions` ADD `lock_question_contribution` integer DEFAULT false NOT NULL;