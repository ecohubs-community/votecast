import { eq, sql, asc } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import { proposalChoice, vote } from '$lib/server/db/schema';
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
 * NOTE (legacy path): still tallies by `vote.choiceId`. The vote-path switch replaces this with the
 * voting-library `tallyBallots` over `vote_selection`.
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
