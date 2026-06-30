import { eq, and, desc } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import { proposal, proposalChoice, vote, voteSelection, user } from '$lib/server/db/schema';
import { ServiceError, ErrorCode } from './errors';
import { emit } from '../events';
import { requireMember } from './membership-service';
import { transitionProposalStatus } from './proposal-service';
import { resolveMethodContext } from './proposal-type-service';
import { isVotingOpen } from './proposal-phase';
import {
	isEligible,
	resolveVotingPower,
	canSeeHiddenTally,
	type CommunityRole
} from '$lib/server/voting';
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

	// Transition to ensure phase/status are current, then gate on the voting phase.
	const current = await transitionProposalStatus(found, db);

	if (!isVotingOpen(current.phase)) {
		throw new ServiceError(
			ErrorCode.PROPOSAL_NOT_ACTIVE,
			current.phase === 'draft' || current.phase === 'deliberation'
				? 'Voting has not started yet'
				: 'Voting has ended'
		);
	}

	// Verify membership, then the method's eligibility axis (all-members = membership; trained etc.
	// fail closed until their data sources land).
	await requireMember(current.communityId, userId, db);
	const { snapshot } = await resolveMethodContext(current, db);
	if (!isEligible(snapshot.eligibility, { isMember: true })) {
		throw new ServiceError(ErrorCode.FORBIDDEN, 'You are not eligible to vote on this proposal');
	}

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

	// Voting power from the weight axis (1 for one-person-one-vote).
	const votingPower = resolveVotingPower(snapshot.weight, {});

	// Atomic: write the vote envelope + its selection (the choice lives on vote_selection).
	const created = db.transaction((tx) => {
		const v = tx
			.insert(vote)
			.values({
				proposalId: input.proposalId,
				userId,
				votingPower,
				signature: input.signature ?? null
			})
			.returning()
			.get();
		tx.insert(voteSelection)
			.values({ proposalId: input.proposalId, userId, choiceId: input.choiceId })
			.run();
		return v;
	});

	emit('vote.cast', {
		voteId: created.id,
		proposalId: input.proposalId,
		userId,
		choiceId: input.choiceId
	});

	return created;
}

/**
 * Get a user's vote on a specific proposal, if any. Returns the vote envelope plus the chosen
 * `choiceId` from its selection (single-choice display), or null.
 */
export async function getUserVote(userId: string, proposalId: string, db: Database = defaultDb) {
	const [found] = await db
		.select({
			id: vote.id,
			proposalId: vote.proposalId,
			userId: vote.userId,
			votingPower: vote.votingPower,
			createdAt: vote.createdAt,
			choiceId: voteSelection.choiceId
		})
		.from(vote)
		.leftJoin(
			voteSelection,
			and(eq(voteSelection.proposalId, vote.proposalId), eq(voteSelection.userId, vote.userId))
		)
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
 * Caller must verify community access before calling this function.
 *
 * Voter-identity visibility (axis 6 / task 6.4): for a secret ballot, individual votes are exposed
 * only to a facilitator (admin); other viewers get a FORBIDDEN error. The aggregate tally is
 * unaffected — see `tallyProposal`.
 */
export async function getProposalVoters(
	proposalId: string,
	db: Database = defaultDb,
	viewerRole: CommunityRole = 'member'
): Promise<VoterRecord[]> {
	const [p] = await db
		.select({
			methodOverrideJson: proposal.methodOverrideJson,
			typeVersionId: proposal.typeVersionId
		})
		.from(proposal)
		.where(eq(proposal.id, proposalId))
		.limit(1);
	if (p) {
		const { snapshot } = await resolveMethodContext(p, db);
		if (snapshot.visibility.secretBallot && !canSeeHiddenTally(viewerRole)) {
			throw new ServiceError(ErrorCode.FORBIDDEN, 'Individual votes are secret for this proposal');
		}
	}

	const rows = await db
		.select({
			voteId: vote.id,
			userId: voteSelection.userId,
			displayName: user.displayName,
			name: user.name,
			choiceId: voteSelection.choiceId,
			choiceLabel: proposalChoice.label,
			votedAt: vote.createdAt
		})
		.from(voteSelection)
		.innerJoin(
			vote,
			and(eq(vote.proposalId, voteSelection.proposalId), eq(vote.userId, voteSelection.userId))
		)
		.innerJoin(user, eq(user.id, voteSelection.userId))
		.innerJoin(proposalChoice, eq(proposalChoice.id, voteSelection.choiceId))
		.where(eq(voteSelection.proposalId, proposalId))
		.orderBy(desc(vote.createdAt));

	return rows.map((r) => ({
		...r,
		choiceId: r.choiceId as string, // innerJoin on proposalChoice guarantees non-null (choice ballots)
		votedAt: r.votedAt ?? new Date()
	}));
}
