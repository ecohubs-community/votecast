import type {
	BallotModule,
	BallotRecord,
	CanonicalTally,
	TallyContext,
	VoteContext
} from '../contracts';

export type MultiQuestionPosition = 'agree' | 'disagree' | 'pass';

/** One voter answers each frozen sub-question (Common Ground — multi-question, D10). */
export interface MultiQuestionSelection {
	questionId: string;
	position: MultiQuestionPosition;
}

function isMQ(s: unknown): s is MultiQuestionSelection {
	const o = s as { questionId?: unknown; position?: unknown };
	return (
		typeof o?.questionId === 'string' &&
		(o.position === 'agree' || o.position === 'disagree' || o.position === 'pass')
	);
}

/** optionId encoding so a per-question position maps onto a flat OptionAggregate list. */
export const mqOptionId = (questionId: string, position: MultiQuestionPosition) =>
	`${questionId}:${position}`;

export const multiQuestionModule: BallotModule<MultiQuestionSelection> = {
	id: 'multi-question',
	tallyFamily: 'multiQuestion',
	honoredKnobs: ['quorum', 'voteMutability', 'ballotSecrecy', 'tallyRevealTiming'],

	validateVote(submission, ctx: VoteContext) {
		const selections = (submission as { selections?: unknown[] })?.selections;
		if (!Array.isArray(selections) || selections.length === 0) {
			return { ok: false, reason: 'Answer at least one question.' };
		}
		const questions = new Set(ctx.frozenOptions.map((o) => o.group).filter(Boolean));
		const seen = new Set<string>();
		for (const sel of selections) {
			if (!isMQ(sel)) return { ok: false, reason: 'Malformed answer.' };
			if (!questions.has(sel.questionId)) return { ok: false, reason: 'Unknown question.' };
			if (seen.has(sel.questionId))
				return { ok: false, reason: 'Duplicate answer for a question.' };
			seen.add(sel.questionId);
		}
		return { ok: true };
	},

	aggregate(ballots: BallotRecord<MultiQuestionSelection>[], ctx: TallyContext): CanonicalTally {
		const byOption = new Map(
			ctx.options.map((o) => [
				o.optionId,
				{ optionId: o.optionId, group: o.group, count: 0, weight: 0 }
			])
		);
		const voters = new Set<string>();
		for (const b of ballots) {
			for (const sel of b.selections) {
				if (!isMQ(sel)) continue;
				const agg = byOption.get(mqOptionId(sel.questionId, sel.position));
				if (!agg) continue;
				agg.count += 1;
				agg.weight += b.votingPower;
				voters.add(b.voterId);
			}
		}
		return {
			family: 'multiQuestion',
			eligibleCount: ctx.eligibleVoterCount,
			ballotsCast: voters.size,
			options: [...byOption.values()]
		};
	},

	components: { ballot: 'MultiQuestionBallot', results: 'MultiQuestionResults' }
};
