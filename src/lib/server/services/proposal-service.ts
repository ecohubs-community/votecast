import { eq, and, desc, lt, lte, gt, or, count, asc } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import { community, communityMember, proposal, proposalChoice } from '$lib/server/db/schema';
import { ServiceError, ErrorCode } from './errors';
import { emit } from '../events';
import { requireMember } from './membership-service';
import {
	DEFAULT_METHOD,
	validateMethodBinding,
	canSeeHiddenTally,
	type MethodBinding,
	type CommunityRole,
	type ResultSet
} from '$lib/server/voting';
import {
	validateTitle,
	validateBody,
	validateChoices,
	toDate,
	validateVisibility
} from './proposal-validation';
import { transitionProposalStatus } from './proposal-lifecycle';
import { computePhase } from './proposal-phase-compute';
import { aggregateResults, tallyProposal, type ProposalResults } from './proposal-results';
import { getTypeVersionForCommunity, resolveMethodContext } from './proposal-type-service';
import {
	type PaginationParams,
	type PaginatedResult,
	type Database,
	encodeCursor,
	decodeCursor,
	clampLimit
} from './types';

// Re-exported for back-compat with existing importers (vote-service, events, routes).
export { transitionProposalStatus };
export type { ProposalResults };

// ─── Input / output types ────────────────────────────────────────────────────

export interface CreateProposalInput {
	communityId: string;
	title: string;
	body: string;
	choices: string[];
	startTime: Date | string;
	endTime: Date | string;
	visibility?: 'public' | 'community';
	typeVersionId?: string; // pin the proposal to a community type version (the proposer's type pick)
	method?: MethodBinding; // ad-hoc per-proposal override (ballot + rule + config); supersedes the type
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
	// Lifecycle category, resolved from the proposal's times at query time.
	phase?: 'upcoming' | 'voting' | 'closed';
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

	// Resolve + validate the voting method via the registry (replaces the onePersonOneVote-only guard).
	const method = input.method ?? DEFAULT_METHOD;
	const bindingCheck = validateMethodBinding(method);
	if (!bindingCheck.ok) {
		throw new ServiceError(
			ErrorCode.INVALID_REQUEST,
			`Invalid voting method: ${bindingCheck.errors.join(' ')}`
		);
	}
	// Pin the chosen type version (the proposer's type pick), validating it belongs to the community.
	let typeVersionId: string | null = null;
	if (input.typeVersionId) {
		typeVersionId = await getTypeVersionForCommunity(input.typeVersionId, input.communityId, db);
		if (!typeVersionId) {
			throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Unknown proposal type for this community');
		}
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
				typeVersionId,
				methodOverrideJson: input.method ? JSON.stringify(input.method) : null,
				visibility: input.visibility ?? 'community',
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

	// Transition first to ensure the phase is up to date; only editable before voting opens.
	const current = await transitionProposalStatus(found, db);

	if (current.phase !== 'draft' && current.phase !== 'deliberation') {
		throw new ServiceError(
			ErrorCode.PROPOSAL_NOT_EDITABLE,
			'A proposal can only be edited before voting opens'
		);
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
	const now = new Date();
	const limit = clampLimit(pagination.limit);
	const cursor = pagination.cursor ? decodeCursor(pagination.cursor) : null;

	const conditions = [eq(proposal.communityId, communityId)];

	// Phase filter resolved from times (no stored-phase dependency): upcoming = not yet open,
	// voting = open, closed = ended. (Lists collapse deliberation→upcoming, objection-window→closed.)
	if (filters.phase === 'upcoming') {
		conditions.push(gt(proposal.startTime, now));
	} else if (filters.phase === 'voting') {
		conditions.push(and(lte(proposal.startTime, now), gt(proposal.endTime, now))!);
	} else if (filters.phase === 'closed') {
		conditions.push(lte(proposal.endTime, now));
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
	const sliced = hasMore ? rows.slice(0, limit) : rows;

	// Stamp a current display phase from times (lists don't resolve deliberation/objection windows).
	const nowMs = now.getTime();
	const items = sliced.map((p) => ({
		...p,
		phase: computePhase(
			{
				startTime: p.startTime,
				endTime: p.endTime,
				deliberationSeconds: 0,
				objectionWindowSeconds: 0
			},
			nowMs
		)
	}));

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

/** Whether the aggregate tally may be revealed to this viewer now (visibility axis / tasks 6.2, 7.4). */
function canRevealTally(
	reveal: 'live' | 'on-close' | 'hidden-forever',
	phase: string,
	viewerRole: CommunityRole
): boolean {
	// No outcome exists until voting has started — never reveal one during draft/deliberation,
	// even to a facilitator (otherwise a not-yet-started consensus proposal shows "Passed").
	if (phase === 'draft' || phase === 'deliberation') return false;
	if (canSeeHiddenTally(viewerRole)) return true; // a facilitator always sees it once voting is live
	if (reveal === 'hidden-forever') return false;
	if (reveal === 'live') return true;
	return phase === 'objection-window' || phase === 'finalized'; // on-close: only once voting has closed
}

export interface ProposalOutcome {
	revealed: boolean;
	result?: ResultSet;
}

/**
 * Access-checked rich outcome via the voting library (task 7.4), gated by the method's tally-reveal
 * timing (task 6.2): `live` always; `on-close` only once voting has closed; `hidden-forever` only to
 * a facilitator. Returns `{ revealed: false }` when the tally must stay hidden.
 */
export async function getProposalOutcome(
	proposalId: string,
	userId?: string,
	db: Database = defaultDb,
	viewerRole: CommunityRole = 'member'
): Promise<ProposalOutcome> {
	const [found] = await db.select().from(proposal).where(eq(proposal.id, proposalId)).limit(1);
	if (!found) throw new ServiceError(ErrorCode.NOT_FOUND, 'Proposal not found');

	const current = await transitionProposalStatus(found, db);

	if (current.visibility === 'community') {
		if (!userId)
			throw new ServiceError(ErrorCode.FORBIDDEN, 'Authentication required to view results');
		await requireMember(current.communityId, userId, db);
	}

	const { snapshot } = await resolveMethodContext(current, db);
	if (!canRevealTally(snapshot.visibility.tallyReveal, current.phase, viewerRole)) {
		return { revealed: false };
	}
	return { revealed: true, result: await tallyProposal(proposalId, db) };
}

// ─── Private helpers ─────────────────────────────────────────────────────────

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
