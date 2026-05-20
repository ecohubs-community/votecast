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
		createdBy: text('created_by')
			.notNull()
			.references(() => user.id),
		strategyId: text('strategy_id').notNull().default('onePersonOneVote'),
		visibility: text('visibility', { enum: ['public', 'community'] })
			.notNull()
			.default('community'),
		status: text('status', { enum: ['draft', 'active', 'closed'] })
			.notNull()
			.default('draft'),
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
		index('proposal_status_idx').on(table.status),
		index('proposal_start_time_idx').on(table.startTime),
		index('proposal_end_time_idx').on(table.endTime)
	]
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
		label: text('label').notNull(),
		position: integer('position').notNull()
	},
	(table) => [index('proposal_choice_proposal_idx').on(table.proposalId)]
);

// =============================================================================
// VOTES
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
		choiceId: text('choice_id')
			.notNull()
			.references(() => proposalChoice.id),
		votingPower: integer('voting_power').notNull().default(1),
		metadataJson: text('metadata_json'), // nullable — strategy-specific metadata as JSON string
		signature: text('signature'), // nullable — wallet signature for vote verification (future)
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(timestampDefault).notNull()
	},
	(table) => [
		uniqueIndex('vote_unique_idx').on(table.proposalId, table.userId),
		index('vote_proposal_idx').on(table.proposalId),
		index('vote_user_idx').on(table.userId)
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
