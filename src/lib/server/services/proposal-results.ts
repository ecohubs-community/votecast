import { eq, and, sql, asc, count } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import {
	communityMember,
	proposal,
	proposalChoice,
	vote,
	voteSelection
} from '$lib/server/db/schema';
import { ServiceError, ErrorCode } from './errors';
import { resolveMethodContext } from './proposal-type-service';
import { loadQuestions, buildMqTallyInputs } from './multi-question';
import {
	bindingFromSnapshot,
	tallyBallots,
	type BallotRecord,
	type ResultSet,
	type TallyContext
} from '$lib/server/voting';
import type { Database } from './types';

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

/**
 * Aggregate vote results for a proposal (no access checks). Leaf module — used by both the
 * access-checked `getProposalResults()` and event emission in `transitionProposalStatus()`.
 *
 * Tallies per choice over `vote_selection` (joined to `vote` for voting power) — the flat
 * choice-count view used by the existing results UI. The rich engine path is `tallyProposal`.
 */
export async function aggregateResults(
	proposalId: string,
	db: Database = defaultDb
): Promise<ProposalResults> {
	const results = await db
		.select({
			choiceId: proposalChoice.id,
			label: proposalChoice.label,
			position: proposalChoice.position,
			votes: sql<number>`count(${voteSelection.id})`,
			votingPower: sql<number>`coalesce(sum(${vote.votingPower}), 0)`
		})
		.from(proposalChoice)
		.leftJoin(voteSelection, eq(proposalChoice.id, voteSelection.choiceId))
		.leftJoin(
			vote,
			and(eq(vote.proposalId, voteSelection.proposalId), eq(vote.userId, voteSelection.userId))
		)
		.where(eq(proposalChoice.proposalId, proposalId))
		.groupBy(proposalChoice.id)
		.orderBy(asc(proposalChoice.position));

	// Ballots cast = distinct voters. Summing per-choice selection counts over-counts multi-question
	// ballots (one voter writes a selection per question), so read the vote envelopes directly.
	const [{ value: totalVotes }] = await db
		.select({ value: count() })
		.from(vote)
		.where(eq(vote.proposalId, proposalId));

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

type SelectionRow = {
	userId: string;
	choiceId: string | null;
	questionId: string | null;
	rank: number | null;
	score: number | null;
	consentPosition: 'consent' | 'stand-aside' | 'object' | null;
	reason: string | null;
};

/**
 * Map flat choices + raw selection rows onto the engine encoding (count / consent / ranked / scored).
 * The multi-question peer is `buildMqTallyInputs`; keeping both as named helpers lets `tallyProposal`
 * stay a thin dispatcher instead of hand-rolling each family's mapping inline.
 */
function buildFlatTallyInputs(
	choices: Array<{ id: string; label: string; questionId: string | null }>,
	selRows: SelectionRow[]
) {
	const options = choices.map((c) => ({
		optionId: c.id,
		label: c.label,
		group: c.questionId ?? undefined
	}));
	const selectionsByUser = new Map<string, unknown[]>();
	for (const s of selRows) {
		const selection = s.consentPosition
			? { position: s.consentPosition, reason: s.reason ?? undefined }
			: { choiceId: s.choiceId, questionId: s.questionId ?? undefined, rank: s.rank, score: s.score };
		const list = selectionsByUser.get(s.userId) ?? [];
		list.push(selection);
		selectionsByUser.set(s.userId, list);
	}
	return { options, selectionsByUser };
}

/**
 * Tally a proposal through the voting library (ballot module + decision rule) over `vote_selection`,
 * returning a rich `ResultSet` with the resolved outcome. This is the real engine path; the public
 * results endpoint swaps onto it with the UI (Group 7). Selection mapping currently covers the
 * count + consent families (the data that exists); ranked/score/multi-question land with their UIs.
 */
export async function tallyProposal(
	proposalId: string,
	db: Database = defaultDb
): Promise<ResultSet> {
	const [p] = await db.select().from(proposal).where(eq(proposal.id, proposalId)).limit(1);
	if (!p) throw new ServiceError(ErrorCode.NOT_FOUND, 'Proposal not found');

	const { snapshot } = await resolveMethodContext(p, db);
	const binding = bindingFromSnapshot(snapshot);
	const isMultiQuestion = snapshot.ballotModuleId === 'multi-question';

	const voteRows = await db
		.select({ userId: vote.userId, votingPower: vote.votingPower, createdAt: vote.createdAt })
		.from(vote)
		.where(eq(vote.proposalId, proposalId));

	const selRows = await db
		.select({
			userId: voteSelection.userId,
			choiceId: voteSelection.choiceId,
			questionId: voteSelection.questionId,
			rank: voteSelection.rank,
			score: voteSelection.score,
			consentPosition: voteSelection.consentPosition,
			reason: voteSelection.reason
		})
		.from(voteSelection)
		.where(eq(voteSelection.proposalId, proposalId));

	let options: Array<{ optionId: string; group?: string; label?: string }>;
	const selectionsByUser = new Map<string, unknown[]>();

	if (isMultiQuestion) {
		// Map questions/choices/selections onto the engine's {questionId, position} encoding.
		const questions = await loadQuestions(proposalId, db);
		const mq = buildMqTallyInputs(questions, selRows);
		options = mq.options;
		for (const [uid, sels] of mq.selectionsByUser) selectionsByUser.set(uid, sels);
	} else {
		const choices = await db
			.select({
				id: proposalChoice.id,
				label: proposalChoice.label,
				questionId: proposalChoice.questionId
			})
			.from(proposalChoice)
			.where(eq(proposalChoice.proposalId, proposalId))
			.orderBy(asc(proposalChoice.position));
		const flat = buildFlatTallyInputs(choices, selRows);
		options = flat.options;
		for (const [uid, sels] of flat.selectionsByUser) selectionsByUser.set(uid, sels);
	}

	const ballots: BallotRecord[] = voteRows.map((v) => ({
		voterId: v.userId,
		votingPower: v.votingPower,
		selections: selectionsByUser.get(v.userId) ?? [],
		submittedAt: v.createdAt?.getTime() ?? 0
	}));

	const [{ value: eligibleVoterCount }] = await db
		.select({ value: count() })
		.from(communityMember)
		.where(eq(communityMember.communityId, p.communityId));

	const ctx: TallyContext = {
		config: binding.config,
		phase: p.phase,
		eligibleVoterCount,
		options,
		now: Date.now()
	};

	return tallyBallots(binding, ballots, ctx);
}
