import { eq, and, desc } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import { proposal, proposalChoice, vote, user } from '$lib/server/db/schema';
import { ServiceError, ErrorCode } from './errors';
import { emit } from '../events';
import { requireMember } from './membership-service';
import { transitionProposalStatus } from './proposal-service';
import type { Database } from './types';

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CastVoteInput {
	proposalId: string;
	choiceId: string;
	signature?: string;
}

// ─── Service functions ───────────────────────────────────────────────────────

/**
 * Cast a vote on an active proposal.
 *
 * Validates:
 * - proposal exists and is active
 * - user is a member of the proposal's community
 * - choiceId belongs to this proposal
 * - user has not already voted
 */
export async function castVote(userId: string, input: CastVoteInput, db: Database = defaultDb) {
	// Fetch proposal
	const [found] = await db
		.select()
		.from(proposal)
		.where(eq(proposal.id, input.proposalId))
		.limit(1);

	if (!found) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'Proposal not found');
	}

	// Transition status to ensure it's current
	const current = await transitionProposalStatus(found, db);

	if (current.status !== 'active') {
		throw new ServiceError(
			ErrorCode.PROPOSAL_NOT_ACTIVE,
			current.status === 'draft' ? 'Voting has not started yet' : 'Voting has ended'
		);
	}

	// Verify user is a community member
	await requireMember(current.communityId, userId, db);

	// Verify choice belongs to this proposal
	const [choice] = await db
		.select({ id: proposalChoice.id })
		.from(proposalChoice)
		.where(
			and(eq(proposalChoice.id, input.choiceId), eq(proposalChoice.proposalId, input.proposalId))
		)
		.limit(1);

	if (!choice) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Choice does not belong to this proposal');
	}

	// Check user hasn't already voted
	const [existingVote] = await db
		.select({ id: vote.id })
		.from(vote)
		.where(and(eq(vote.proposalId, input.proposalId), eq(vote.userId, userId)))
		.limit(1);

	if (existingVote) {
		throw new ServiceError(ErrorCode.ALREADY_VOTED, 'You have already voted on this proposal');
	}

	// Determine voting power (1 for onePersonOneVote)
	const votingPower = 1;

	const [created] = await db
		.insert(vote)
		.values({
			proposalId: input.proposalId,
			userId,
			choiceId: input.choiceId,
			votingPower,
			signature: input.signature ?? null
		})
		.returning();

	emit('vote.cast', {
		voteId: created.id,
		proposalId: input.proposalId,
		userId,
		choiceId: input.choiceId
	});

	return created;
}

/**
 * Get a user's vote on a specific proposal, if any.
 * Returns the vote record (including choiceId) or null.
 */
export async function getUserVote(userId: string, proposalId: string, db: Database = defaultDb) {
	const [found] = await db
		.select()
		.from(vote)
		.where(and(eq(vote.proposalId, proposalId), eq(vote.userId, userId)))
		.limit(1);

	return found ?? null;
}

// ─── Voter list ─────────────────────────────────────────────────────────────

export interface VoterRecord {
	voteId: string;
	userId: string;
	displayName: string | null;
	name: string;
	choiceId: string;
	choiceLabel: string;
	votedAt: Date;
}

/**
 * Get all voters for a proposal with their choice labels and timestamps.
 * Caller must verify access before calling this function.
 */
export async function getProposalVoters(
	proposalId: string,
	db: Database = defaultDb
): Promise<VoterRecord[]> {
	const rows = await db
		.select({
			voteId: vote.id,
			userId: vote.userId,
			displayName: user.displayName,
			name: user.name,
			choiceId: vote.choiceId,
			choiceLabel: proposalChoice.label,
			votedAt: vote.createdAt
		})
		.from(vote)
		.innerJoin(user, eq(user.id, vote.userId))
		.innerJoin(proposalChoice, eq(proposalChoice.id, vote.choiceId))
		.where(eq(vote.proposalId, proposalId))
		.orderBy(desc(vote.createdAt));

	return rows.map((r) => ({
		...r,
		choiceId: r.choiceId as string, // innerJoin on proposalChoice guarantees non-null (legacy path)
		votedAt: r.votedAt ?? new Date()
	}));
}
