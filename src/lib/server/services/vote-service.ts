import { eq, and, desc, isNull } from 'drizzle-orm';
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

export interface MultiQuestionVoteInput {
	proposalId: string;
	answers: Array<{ questionId: string; choiceId: string }>;
	signature?: string;
}

// ─── Service functions ───────────────────────────────────────────────────────

/**
 * Shared pre-cast checks: the proposal exists, voting is open, the user is an eligible member.
 * Returns the (transitioned) proposal, its method snapshot, and the resolved voting power.
 */
async function assertCanVote(proposalId: string, userId: string, db: Database) {
	const [found] = await db.select().from(proposal).where(eq(proposal.id, proposalId)).limit(1);
	if (!found) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'Proposal not found');
	}

	const current = await transitionProposalStatus(found, db);
	if (!isVotingOpen(current.phase)) {
		throw new ServiceError(
			ErrorCode.PROPOSAL_NOT_ACTIVE,
			current.phase === 'draft' || current.phase === 'deliberation'
				? 'Voting has not started yet'
				: 'Voting has ended'
		);
	}

	await requireMember(current.communityId, userId, db);
	const { snapshot } = await resolveMethodContext(current, db);
	if (!isEligible(snapshot.eligibility, { isMember: true })) {
		throw new ServiceError(ErrorCode.FORBIDDEN, 'You are not eligible to vote on this proposal');
	}

	return { current, snapshot, votingPower: resolveVotingPower(snapshot.weight, {}) };
}

/** Reject a second ballot from the same voter on the same proposal. */
async function assertNotVoted(proposalId: string, userId: string, db: Database) {
	const [existingVote] = await db
		.select({ id: vote.id })
		.from(vote)
		.where(and(eq(vote.proposalId, proposalId), eq(vote.userId, userId)))
		.limit(1);
	if (existingVote) {
		throw new ServiceError(ErrorCode.ALREADY_VOTED, 'You have already voted on this proposal');
	}
}

/**
 * Cast a Common Ground (multi-question) vote: one position-choice per answered sub-question. Each
 * answer's choice must belong to its question on this proposal; writes one `vote_selection` per answer.
 */
export async function castMultiQuestionVote(
	userId: string,
	input: MultiQuestionVoteInput,
	db: Database = defaultDb
) {
	const { votingPower } = await assertCanVote(input.proposalId, userId, db);

	const answers = input.answers ?? [];
	if (answers.length === 0) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Answer at least one question.');
	}
	const seenQuestions = new Set<string>();
	for (const a of answers) {
		if (seenQuestions.has(a.questionId)) {
			throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Duplicate answer for a question.');
		}
		seenQuestions.add(a.questionId);
	}

	// Validate every (questionId, choiceId) pair belongs to this proposal.
	const validChoices = await db
		.select({ id: proposalChoice.id, questionId: proposalChoice.questionId })
		.from(proposalChoice)
		.where(eq(proposalChoice.proposalId, input.proposalId));
	const validPairs = new Set(validChoices.map((c) => `${c.questionId}:${c.id}`));
	for (const a of answers) {
		if (!validPairs.has(`${a.questionId}:${a.choiceId}`)) {
			throw new ServiceError(
				ErrorCode.INVALID_REQUEST,
				'A selection does not belong to its question.'
			);
		}
	}

	await assertNotVoted(input.proposalId, userId, db);

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
			.values(
				answers.map((a) => ({
					proposalId: input.proposalId,
					userId,
					questionId: a.questionId,
					choiceId: a.choiceId
				}))
			)
			.run();
		return v;
	});

	emit('vote.cast', {
		voteId: created.id,
		proposalId: input.proposalId,
		userId,
		choiceId: answers[0].choiceId
	});

	return created;
}

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
	const { votingPower } = await assertCanVote(input.proposalId, userId, db);

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

	await assertNotVoted(input.proposalId, userId, db);

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
	// Null for ballots without a single flat choice (consent, multi-question).
	choiceId: string | null;
	choiceLabel: string | null;
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

	// Base on the vote envelope (one row per voter, guaranteed by the unique index) so consent and
	// multi-question ballots aren't dropped or multiplied. Attach the flat single-choice label when
	// there is one (the selection with no questionId); null otherwise.
	const rows = await db
		.select({
			voteId: vote.id,
			userId: vote.userId,
			displayName: user.displayName,
			name: user.name,
			choiceId: voteSelection.choiceId,
			choiceLabel: proposalChoice.label,
			votedAt: vote.createdAt
		})
		.from(vote)
		.innerJoin(user, eq(user.id, vote.userId))
		.leftJoin(
			voteSelection,
			and(
				eq(voteSelection.proposalId, vote.proposalId),
				eq(voteSelection.userId, vote.userId),
				isNull(voteSelection.questionId)
			)
		)
		.leftJoin(proposalChoice, eq(proposalChoice.id, voteSelection.choiceId))
		.where(eq(vote.proposalId, proposalId))
		.orderBy(desc(vote.createdAt));

	return rows.map((r) => ({ ...r, votedAt: r.votedAt ?? new Date() }));
}
