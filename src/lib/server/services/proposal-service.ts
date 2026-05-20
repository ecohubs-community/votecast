import { eq, and, desc, lt, or, count, sql, asc, lte } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import { community, communityMember, proposal, proposalChoice, vote } from '$lib/server/db/schema';
import { ServiceError, ErrorCode } from './errors';
import { emit } from '../events';
import { requireMember, requireAdmin } from './membership-service';
import {
	type PaginationParams,
	type PaginatedResult,
	type Database,
	encodeCursor,
	decodeCursor,
	clampLimit
} from './types';

// ─── Input / output types ────────────────────────────────────────────────────

export interface CreateProposalInput {
	communityId: string;
	title: string;
	body: string;
	choices: string[];
	startTime: Date | string;
	endTime: Date | string;
	visibility?: 'public' | 'community';
	strategyId?: string;
}

export interface UpdateProposalInput {
	title?: string;
	body?: string;
	choices?: string[];
	startTime?: Date | string;
	endTime?: Date | string;
	visibility?: 'public' | 'community';
}

export interface ProposalFilters {
	status?: 'draft' | 'active' | 'closed';
}

export interface ProposalResults {
	proposalId: string;
	totalVotes: number;
	results: Array<{
		choiceId: string;
		label: string;
		votes: number;
		votingPower: number;
	}>;
}

// ─── Validation helpers ──────────────────────────────────────────────────────

function validateTitle(title: unknown): asserts title is string {
	if (typeof title !== 'string' || title.trim().length === 0) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Title is required');
	}
	if (title.trim().length > 200) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Title must be at most 200 characters');
	}
}

function validateBody(body: unknown): asserts body is string {
	if (typeof body !== 'string' || body.trim().length === 0) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Body is required');
	}
	if (body.length > 10000) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Body must be at most 10000 characters');
	}
}

function validateChoices(choices: unknown): asserts choices is string[] {
	if (!Array.isArray(choices)) {
		throw new ServiceError(ErrorCode.INVALID_CHOICES, 'Choices must be an array');
	}
	if (choices.length < 2) {
		throw new ServiceError(ErrorCode.INVALID_CHOICES, 'At least 2 choices are required');
	}
	if (choices.length > 20) {
		throw new ServiceError(ErrorCode.INVALID_CHOICES, 'At most 20 choices are allowed');
	}
	for (const choice of choices) {
		if (typeof choice !== 'string' || choice.trim().length === 0) {
			throw new ServiceError(ErrorCode.INVALID_CHOICES, 'Each choice must be a non-empty string');
		}
		if (choice.trim().length > 200) {
			throw new ServiceError(
				ErrorCode.INVALID_CHOICES,
				'Each choice must be at most 200 characters'
			);
		}
	}
}

function toDate(value: Date | string): Date {
	const d = typeof value === 'string' ? new Date(value) : value;
	if (isNaN(d.getTime())) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Invalid date');
	}
	return d;
}

function validateVisibility(v: unknown): asserts v is 'public' | 'community' {
	if (v !== 'public' && v !== 'community') {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Visibility must be "public" or "community"');
	}
}

// ─── Status transition ──────────────────────────────────────────────────────

type ProposalRecord = typeof proposal.$inferSelect;

/**
 * Lazily transition a proposal's status based on current time.
 * - draft → active when now >= startTime
 * - draft/active → closed when now >= endTime
 *
 * Updates the DB so subsequent reads are fast.
 * Exported for use by vote-service.
 */
export async function transitionProposalStatus(
	p: ProposalRecord,
	db: Database = defaultDb
): Promise<ProposalRecord> {
	const now = Date.now();
	let newStatus = p.status;
	const originalStatus = p.status;

	if (p.status === 'draft' && p.startTime.getTime() <= now) {
		newStatus = 'active';
	}
	if (
		(p.status === 'draft' || p.status === 'active' || newStatus === 'active') &&
		p.endTime.getTime() <= now
	) {
		newStatus = 'closed';
	}

	if (newStatus !== originalStatus) {
		await db.update(proposal).set({ status: newStatus }).where(eq(proposal.id, p.id));

		// Emit events after successful DB write
		// If draft→active (not skipping to closed), emit proposal.started
		if (newStatus === 'active') {
			emit('proposal.started', { proposalId: p.id, communityId: p.communityId });
		}

		// If transitioning to closed, emit proposal.closed with results
		if (newStatus === 'closed') {
			const results = await aggregateResults(p.id, db);
			emit('proposal.closed', { proposalId: p.id, communityId: p.communityId, results });
		}

		return { ...p, status: newStatus };
	}

	return p;
}

/**
 * Batch-transition stale statuses for a community before listing.
 * More efficient than transitioning one at a time.
 */
async function batchTransitionStatuses(communityId: string, db: Database = defaultDb) {
	const now = new Date();

	// draft → active where startTime has passed (but endTime hasn't)
	await db
		.update(proposal)
		.set({ status: 'active' })
		.where(
			and(
				eq(proposal.communityId, communityId),
				eq(proposal.status, 'draft'),
				lte(proposal.startTime, now)
				// Only set to active if endTime hasn't passed yet
				// otherwise the next query will set to closed
			)
		);

	// draft/active → closed where endTime has passed
	await db
		.update(proposal)
		.set({ status: 'closed' })
		.where(
			and(
				eq(proposal.communityId, communityId),
				or(eq(proposal.status, 'draft'), eq(proposal.status, 'active')),
				lte(proposal.endTime, now)
			)
		);
}

// ─── Service functions ───────────────────────────────────────────────────────

/**
 * Create a new proposal within a community.
 */
export async function createProposal(
	userId: string,
	input: CreateProposalInput,
	db: Database = defaultDb
) {
	// Verify membership
	await requireMember(input.communityId, userId, db);

	// Validate input
	const title = input.title?.trim();
	validateTitle(title);
	const body = input.body?.trim();
	validateBody(body);
	validateChoices(input.choices);

	const startTime = toDate(input.startTime);
	const endTime = toDate(input.endTime);

	if (startTime.getTime() >= endTime.getTime()) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Start time must be before end time');
	}

	if (input.visibility !== undefined) {
		validateVisibility(input.visibility);
	}

	const strategyId = input.strategyId ?? 'onePersonOneVote';
	if (strategyId !== 'onePersonOneVote') {
		throw new ServiceError(
			ErrorCode.INVALID_REQUEST,
			'Only "onePersonOneVote" strategy is supported'
		);
	}

	// Check unverified community proposal limit
	await checkProposalLimit(input.communityId, db);

	// Atomic: insert proposal + choices
	// Note: better-sqlite3 transactions are synchronous — no async/await inside
	const result = db.transaction((tx) => {
		const created = tx
			.insert(proposal)
			.values({
				communityId: input.communityId,
				title,
				body,
				createdBy: userId,
				strategyId,
				visibility: input.visibility ?? 'community',
				status: 'draft',
				startTime,
				endTime
			})
			.returning()
			.get();

		const choiceValues = input.choices.map((label, index) => ({
			proposalId: created.id,
			label: label.trim(),
			position: index
		}));

		tx.insert(proposalChoice).values(choiceValues).run();

		return created;
	});

	emit('proposal.created', {
		proposalId: result.id,
		communityId: input.communityId,
		createdBy: userId
	});

	return result;
}

/**
 * Update a draft proposal. Only the creator or a community admin can edit.
 */
export async function updateProposal(
	userId: string,
	proposalId: string,
	input: UpdateProposalInput,
	db: Database = defaultDb
) {
	// Fetch proposal
	const [found] = await db.select().from(proposal).where(eq(proposal.id, proposalId)).limit(1);

	if (!found) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'Proposal not found');
	}

	// Transition status first to ensure it's up to date
	const current = await transitionProposalStatus(found, db);

	if (current.status !== 'draft') {
		throw new ServiceError(ErrorCode.PROPOSAL_NOT_EDITABLE, 'Only draft proposals can be edited');
	}

	// Check permission: creator or admin
	if (current.createdBy !== userId) {
		const [admin] = await db
			.select({ id: communityMember.id })
			.from(communityMember)
			.where(
				and(
					eq(communityMember.communityId, current.communityId),
					eq(communityMember.userId, userId),
					eq(communityMember.role, 'admin')
				)
			)
			.limit(1);

		if (!admin) {
			throw new ServiceError(
				ErrorCode.FORBIDDEN,
				'Only the proposal creator or a community admin can edit'
			);
		}
	}

	// Build updates
	const updates: Record<string, unknown> = {};

	if (input.title !== undefined) {
		const title = input.title.trim();
		validateTitle(title);
		updates.title = title;
	}
	if (input.body !== undefined) {
		const body = input.body.trim();
		validateBody(body);
		updates.body = body;
	}
	if (input.visibility !== undefined) {
		validateVisibility(input.visibility);
		updates.visibility = input.visibility;
	}

	// Handle time updates — validate against each other
	let startTime = current.startTime;
	let endTime = current.endTime;

	if (input.startTime !== undefined) {
		startTime = toDate(input.startTime);
		updates.startTime = startTime;
	}
	if (input.endTime !== undefined) {
		endTime = toDate(input.endTime);
		updates.endTime = endTime;
	}
	if (input.startTime !== undefined || input.endTime !== undefined) {
		if (startTime.getTime() >= endTime.getTime()) {
			throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Start time must be before end time');
		}
	}

	// Handle choices replacement
	if (input.choices !== undefined) {
		validateChoices(input.choices);
	}

	const hasFieldUpdates = Object.keys(updates).length > 0;
	const hasChoiceUpdates = input.choices !== undefined;

	if (!hasFieldUpdates && !hasChoiceUpdates) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'No fields to update');
	}

	// Note: better-sqlite3 transactions are synchronous — no async/await inside
	return db.transaction((tx) => {
		if (hasChoiceUpdates) {
			// Delete existing choices and insert new ones
			tx.delete(proposalChoice).where(eq(proposalChoice.proposalId, proposalId)).run();

			const choiceValues = input.choices!.map((label, index) => ({
				proposalId,
				label: label.trim(),
				position: index
			}));

			tx.insert(proposalChoice).values(choiceValues).run();
		}

		if (hasFieldUpdates) {
			tx.update(proposal).set(updates).where(eq(proposal.id, proposalId)).run();
		}

		// Return updated proposal
		const updated = tx.select().from(proposal).where(eq(proposal.id, proposalId)).limit(1).get();

		return updated!;
	});
}

/**
 * Get a proposal by ID, including its choices.
 */
export async function getProposal(proposalId: string, userId?: string, db: Database = defaultDb) {
	const [found] = await db.select().from(proposal).where(eq(proposal.id, proposalId)).limit(1);

	if (!found) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'Proposal not found');
	}

	// Transition status
	const current = await transitionProposalStatus(found, db);

	// Check visibility
	if (current.visibility === 'community') {
		if (!userId) {
			throw new ServiceError(ErrorCode.FORBIDDEN, 'Authentication required to view this proposal');
		}
		await requireMember(current.communityId, userId, db);
	}

	// Fetch choices
	const choices = await db
		.select()
		.from(proposalChoice)
		.where(eq(proposalChoice.proposalId, proposalId))
		.orderBy(asc(proposalChoice.position));

	return { ...current, choices };
}

/**
 * List proposals for a community, optionally filtered by status.
 */
export async function listProposals(
	communityId: string,
	filters: ProposalFilters = {},
	pagination: PaginationParams = {},
	db: Database = defaultDb
): Promise<PaginatedResult<typeof proposal.$inferSelect>> {
	// Batch-transition stale statuses first
	await batchTransitionStatuses(communityId, db);

	const limit = clampLimit(pagination.limit);
	const cursor = pagination.cursor ? decodeCursor(pagination.cursor) : null;

	const conditions = [eq(proposal.communityId, communityId)];

	if (filters.status) {
		conditions.push(eq(proposal.status, filters.status));
	}

	if (cursor) {
		conditions.push(
			or(
				lt(proposal.createdAt, new Date(cursor.ts)),
				and(eq(proposal.createdAt, new Date(cursor.ts)), lt(proposal.id, cursor.id))
			)!
		);
	}

	const rows = await db
		.select()
		.from(proposal)
		.where(and(...conditions))
		.orderBy(desc(proposal.createdAt), desc(proposal.id))
		.limit(limit + 1);

	const hasMore = rows.length > limit;
	const items = hasMore ? rows.slice(0, limit) : rows;

	const nextCursor =
		hasMore && items.length > 0
			? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
			: null;

	return { items, nextCursor };
}

/**
 * Get voting results for a proposal.
 */
export async function getProposalResults(
	proposalId: string,
	userId?: string,
	db: Database = defaultDb
): Promise<ProposalResults> {
	// Fetch proposal (with status transition and visibility check)
	const [found] = await db.select().from(proposal).where(eq(proposal.id, proposalId)).limit(1);

	if (!found) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'Proposal not found');
	}

	await transitionProposalStatus(found, db);

	// Check visibility
	if (found.visibility === 'community') {
		if (!userId) {
			throw new ServiceError(ErrorCode.FORBIDDEN, 'Authentication required to view results');
		}
		await requireMember(found.communityId, userId, db);
	}

	return aggregateResults(proposalId, db);
}

// ─── Private helpers ─────────────────────────────────────────────────────────

/**
 * Aggregate vote results for a proposal (no access checks).
 * Used by both `getProposalResults()` and event emission in `transitionProposalStatus()`.
 */
async function aggregateResults(
	proposalId: string,
	db: Database = defaultDb
): Promise<ProposalResults> {
	const results = await db
		.select({
			choiceId: proposalChoice.id,
			label: proposalChoice.label,
			position: proposalChoice.position,
			votes: sql<number>`count(${vote.id})`,
			votingPower: sql<number>`coalesce(sum(${vote.votingPower}), 0)`
		})
		.from(proposalChoice)
		.leftJoin(vote, eq(proposalChoice.id, vote.choiceId))
		.where(eq(proposalChoice.proposalId, proposalId))
		.groupBy(proposalChoice.id)
		.orderBy(asc(proposalChoice.position));

	const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);

	return {
		proposalId,
		totalVotes,
		results: results.map((r) => ({
			choiceId: r.choiceId,
			label: r.label,
			votes: r.votes,
			votingPower: r.votingPower
		}))
	};
}

/**
 * Check that an unverified community has not reached its proposal limit (20).
 */
async function checkProposalLimit(communityId: string, db: Database = defaultDb) {
	const [comm] = await db
		.select({ verified: community.verified })
		.from(community)
		.where(eq(community.id, communityId))
		.limit(1);

	if (!comm) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'Community not found');
	}

	if (!comm.verified) {
		const [{ proposalCount }] = await db
			.select({ proposalCount: count() })
			.from(proposal)
			.where(eq(proposal.communityId, communityId));

		if (proposalCount >= 20) {
			throw new ServiceError(
				ErrorCode.COMMUNITY_LIMIT_REACHED,
				'Unverified communities are limited to 20 proposals'
			);
		}
	}
}
