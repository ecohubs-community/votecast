import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { user } from './auth.schema';

// Shared timestamp default matching better-auth's pattern (milliseconds)
const timestampDefault = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

// =============================================================================
// COMMUNITIES
// =============================================================================

export const community = sqliteTable(
	'communities',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: text('name').notNull(),
		slug: text('slug').notNull().unique(),
		description: text('description').notNull().default(''),
		visibility: text('visibility', { enum: ['public', 'community'] })
			.notNull()
			.default('public'),
		verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
		createdBy: text('created_by')
			.notNull()
			.references(() => user.id),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(timestampDefault).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(timestampDefault)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('community_created_by_idx').on(table.createdBy)]
);

// =============================================================================
// COMMUNITY MEMBERS
// =============================================================================

export const communityMember = sqliteTable(
	'community_members',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		communityId: text('community_id')
			.notNull()
			.references(() => community.id),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		role: text('role', { enum: ['admin', 'member'] })
			.notNull()
			.default('member'),
		joinedAt: integer('joined_at', { mode: 'timestamp_ms' }).default(timestampDefault).notNull()
	},
	(table) => [
		uniqueIndex('community_member_unique_idx').on(table.communityId, table.userId),
		index('community_member_user_idx').on(table.userId),
		index('community_member_community_idx').on(table.communityId)
	]
);

// =============================================================================
// INVITES
// =============================================================================

export const invite = sqliteTable(
	'invites',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		communityId: text('community_id')
			.notNull()
			.references(() => community.id),
		createdBy: text('created_by')
			.notNull()
			.references(() => user.id),
		token: text('token')
			.notNull()
			.unique()
			.$defaultFn(() => crypto.randomUUID()),
		maxUses: integer('max_uses'), // nullable = unlimited
		uses: integer('uses').notNull().default(0),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(timestampDefault).notNull()
	},
	(table) => [index('invite_community_idx').on(table.communityId)]
);

// =============================================================================
// PROPOSAL TYPES  (per-community, user-maintainable — design D4)
// =============================================================================

export const proposalType = sqliteTable(
	'proposal_types',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		communityId: text('community_id')
			.notNull()
			.references(() => community.id),
		name: text('name').notNull(),
		description: text('description').notNull().default(''),
		// When false, proposers cannot override method axes per-proposal (D4).
		overridesAllowed: integer('overrides_allowed', { mode: 'boolean' }).notNull().default(true),
		// Retiring a type blocks new proposals while pinned proposals keep running (proposal-types spec).
		retiredAt: integer('retired_at', { mode: 'timestamp_ms' }),
		createdBy: text('created_by')
			.notNull()
			.references(() => user.id),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(timestampDefault).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(timestampDefault)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('proposal_type_community_idx').on(table.communityId)]
);

// =============================================================================
// PROPOSAL TYPE VERSIONS  (immutable whole-method snapshot — design D4/D12)
// =============================================================================

export const proposalTypeVersion = sqliteTable(
	'proposal_type_versions',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		typeId: text('type_id')
			.notNull()
			.references(() => proposalType.id, { onDelete: 'cascade' }),
		version: integer('version').notNull(),
		// Frozen method: { ballotModuleId, decisionRuleId, fallbackRuleId?, eligibility, weight,
		// process, visibility, knobs } — the whole method, never mutated once written (D4/D12).
		methodSnapshotJson: text('method_snapshot_json').notNull(),
		deliberationSeconds: integer('deliberation_seconds').notNull().default(0),
		// Voting window length (default 3 days) — the proposer's voting-end default.
		votingSeconds: integer('voting_seconds').notNull().default(259200),
		// Type-level defaults (pre-fill the create form); each lockable (locked = proposer can't change).
		defaultChoicesJson: text('default_choices_json'), // JSON string[] | null (n/a for multi-question)
		defaultVisibility: text('default_visibility', { enum: ['public', 'community'] })
			.notNull()
			.default('community'),
		lockChoices: integer('lock_choices', { mode: 'boolean' }).notNull().default(false),
		lockDeliberation: integer('lock_deliberation', { mode: 'boolean' }).notNull().default(false),
		lockVoting: integer('lock_voting', { mode: 'boolean' }).notNull().default(false),
		lockVisibility: integer('lock_visibility', { mode: 'boolean' }).notNull().default(false),
		// Common Ground: who may add questions and when (frozen at voting-open). Design D8.
		questionContributors: text('question_contributors', { enum: ['proposer', 'members'] })
			.notNull()
			.default('proposer'),
		questionContributionPhase: text('question_contribution_phase', {
			enum: ['creation', 'deliberation']
		})
			.notNull()
			.default('creation'),
		lockQuestionContribution: integer('lock_question_contribution', { mode: 'boolean' })
			.notNull()
			.default(false),
		createdBy: text('created_by')
			.notNull()
			.references(() => user.id),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(timestampDefault).notNull()
	},
	(table) => [
		uniqueIndex('proposal_type_version_unique_idx').on(table.typeId, table.version),
		index('proposal_type_version_type_idx').on(table.typeId)
	]
);

// =============================================================================
// PROPOSALS
// =============================================================================

export const proposal = sqliteTable(
	'proposals',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		communityId: text('community_id')
			.notNull()
			.references(() => community.id),
		title: text('title').notNull(),
		body: text('body').notNull(),
		rationale: text('rationale'), // optional markdown — the "why" (the body is what's voted on)
		createdBy: text('created_by')
			.notNull()
			.references(() => user.id),
		// Pinned method version (D4). Nullable only to allow back-fill of pre-existing rows; the
		// service layer requires it on all new proposals.
		typeVersionId: text('type_version_id').references(() => proposalTypeVersion.id),
		// Ad-hoc per-proposal override snapshot; when present it supersedes the pinned version (D4).
		methodOverrideJson: text('method_override_json'),
		// Common Ground: the proposal's own question-contribution policy, resolved at creation from the
		// type (with proposer overrides when the type leaves it unlocked). Null = inherit from the type.
		questionContributors: text('question_contributors', { enum: ['proposer', 'members'] }),
		questionContributionPhase: text('question_contribution_phase', {
			enum: ['creation', 'deliberation']
		}),
		visibility: text('visibility', { enum: ['public', 'community'] })
			.notNull()
			.default('community'),
		// Lifecycle PHASE (where in the process) — design D7.
		phase: text('phase', {
			enum: ['draft', 'deliberation', 'voting', 'objection-window', 'finalized']
		})
			.notNull()
			.default('draft'),
		// OUTCOME state (the result) — null until decided; design D7/D9.
		outcome: text('outcome', {
			enum: [
				'passed',
				'failed',
				'blocked',
				'tie',
				'quorum-not-met',
				'indeterminate',
				'provisional',
				'recorded'
			]
		}),
		startTime: integer('start_time', { mode: 'timestamp_ms' }).notNull(),
		endTime: integer('end_time', { mode: 'timestamp_ms' }).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(timestampDefault).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(timestampDefault)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('proposal_community_idx').on(table.communityId),
		index('proposal_phase_idx').on(table.phase),
		index('proposal_type_version_idx').on(table.typeVersionId),
		index('proposal_start_time_idx').on(table.startTime),
		index('proposal_end_time_idx').on(table.endTime)
	]
);

// =============================================================================
// BALLOT QUESTIONS  (multi-question / Common Ground — design D11)
// =============================================================================

export const ballotQuestion = sqliteTable(
	'ballot_questions',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		proposalId: text('proposal_id')
			.notNull()
			.references(() => proposal.id, { onDelete: 'cascade' }),
		prompt: text('prompt').notNull(),
		position: integer('position').notNull()
	},
	(table) => [index('ballot_question_proposal_idx').on(table.proposalId)]
);

// =============================================================================
// PROPOSAL CHOICES
// =============================================================================

export const proposalChoice = sqliteTable(
	'proposal_choices',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		proposalId: text('proposal_id')
			.notNull()
			.references(() => proposal.id, { onDelete: 'cascade' }),
		// A choice belongs to a question; null = the implicit single question (D11).
		questionId: text('question_id').references(() => ballotQuestion.id, { onDelete: 'cascade' }),
		label: text('label').notNull(),
		position: integer('position').notNull()
	},
	(table) => [
		index('proposal_choice_proposal_idx').on(table.proposalId),
		index('proposal_choice_question_idx').on(table.questionId)
	]
);

// =============================================================================
// VOTES  (the per-(proposal,user) ENVELOPE — design D11/D12)
// =============================================================================

export const vote = sqliteTable(
	'votes',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		proposalId: text('proposal_id')
			.notNull()
			.references(() => proposal.id),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		votingPower: integer('voting_power').notNull().default(1),
		// Secret ballot: identity is stored for eligibility/mutability but never exposed (visibility axis).
		secret: integer('secret', { mode: 'boolean' }).notNull().default(false),
		signature: text('signature'), // nullable — wallet signature for vote verification (future)
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(timestampDefault).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(timestampDefault)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		uniqueIndex('vote_unique_idx').on(table.proposalId, table.userId), // one ballot per voter
		index('vote_proposal_idx').on(table.proposalId),
		index('vote_user_idx').on(table.userId)
	]
);

// =============================================================================
// VOTE SELECTIONS  (one row per selection — supports approval/ranked/score/consent/multi-question; D11)
// =============================================================================

export const voteSelection = sqliteTable(
	'vote_selections',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		proposalId: text('proposal_id')
			.notNull()
			.references(() => proposal.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id),
		// For multi-question ballots: which question this selection answers (null = single question).
		questionId: text('question_id').references(() => ballotQuestion.id, { onDelete: 'cascade' }),
		// The chosen option, when the ballot family references choices (null for pure consent ballots).
		choiceId: text('choice_id').references(() => proposalChoice.id, { onDelete: 'cascade' }),
		rank: integer('rank'), // ranked / IRV / STV
		score: integer('score'), // score / STAR
		credits: integer('credits'), // cumulative / quadratic
		consentPosition: text('consent_position', { enum: ['consent', 'stand-aside', 'object'] }),
		reason: text('reason'), // structured justification for an objection (consent ballots)
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(timestampDefault).notNull()
	},
	(table) => [
		index('vote_selection_proposal_idx').on(table.proposalId),
		index('vote_selection_user_idx').on(table.userId),
		index('vote_selection_proposal_user_idx').on(table.proposalId, table.userId)
	]
);

// =============================================================================
// WEBHOOKS
// =============================================================================

export const webhook = sqliteTable(
	'webhooks',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		communityId: text('community_id')
			.notNull()
			.references(() => community.id),
		url: text('url').notNull(),
		secret: text('secret')
			.notNull()
			.$defaultFn(() => `whsec_${crypto.randomUUID()}`),
		events: text('events').notNull(), // JSON string of subscribed event names
		active: integer('active', { mode: 'boolean' }).notNull().default(true),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(timestampDefault).notNull()
	},
	(table) => [index('webhook_community_idx').on(table.communityId)]
);

// =============================================================================
// EXECUTION HANDLERS
// =============================================================================

export const executionHandler = sqliteTable(
	'execution_handlers',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		proposalId: text('proposal_id')
			.notNull()
			.references(() => proposal.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		configJson: text('config_json').notNull(), // JSON string of handler configuration
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(timestampDefault).notNull()
	},
	(table) => [index('execution_handler_proposal_idx').on(table.proposalId)]
);

// =============================================================================
// NOTIFICATIONS  (minimal in-app sink — design D13; rich delivery channels deferred)
// =============================================================================

export const notification = sqliteTable(
	'notifications',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		communityId: text('community_id')
			.notNull()
			.references(() => community.id),
		// null userId = a community-wide broadcast (visible to every member); else a direct notification.
		userId: text('user_id').references(() => user.id),
		proposalId: text('proposal_id').references(() => proposal.id, { onDelete: 'cascade' }),
		event: text('event').notNull(), // the lifecycle event name that produced it
		title: text('title').notNull(),
		body: text('body').notNull().default(''),
		readAt: integer('read_at', { mode: 'timestamp_ms' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(timestampDefault).notNull()
	},
	(table) => [
		index('notification_community_idx').on(table.communityId),
		index('notification_user_idx').on(table.userId)
	]
);
