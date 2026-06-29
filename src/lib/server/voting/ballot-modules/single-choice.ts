import type {
	BallotModule,
	BallotRecord,
	CanonicalTally,
	TallyContext,
	VoteContext
} from '../contracts';

/** One voter picks exactly one choice. */
export interface SingleChoiceSelection {
	choiceId: string;
}

function isSingleChoice(s: unknown): s is SingleChoiceSelection {
	return (
		typeof s === 'object' &&
		s !== null &&
		typeof (s as { choiceId?: unknown }).choiceId === 'string'
	);
}

export const singleChoiceModule: BallotModule<SingleChoiceSelection> = {
	id: 'single-choice',
	tallyFamily: 'count',
	honoredKnobs: ['quorum', 'passThreshold', 'voteMutability', 'ballotSecrecy', 'tallyRevealTiming'],

	validateVote(submission, ctx: VoteContext) {
		const selections = (submission as { selections?: unknown[] })?.selections;
		if (!Array.isArray(selections) || selections.length !== 1) {
			return { ok: false, reason: 'Pick exactly one choice.' };
		}
		const sel = selections[0];
		if (!isSingleChoice(sel)) return { ok: false, reason: 'Malformed selection.' };
		const allowed = new Set(ctx.frozenOptions.map((o) => o.optionId));
		if (!allowed.has(sel.choiceId)) return { ok: false, reason: 'Choice is not on the ballot.' };
		return { ok: true };
	},

	aggregate(ballots: BallotRecord<SingleChoiceSelection>[], ctx: TallyContext): CanonicalTally {
		const byOption = new Map(
			ctx.options.map((o) => [o.optionId, { optionId: o.optionId, count: 0, weight: 0 }])
		);
		let ballotsCast = 0;
		for (const b of ballots) {
			const sel = b.selections[0];
			if (!sel) continue;
			const agg = byOption.get(sel.choiceId);
			if (!agg) continue; // selection for an option no longer on the ballot — ignore
			agg.count += 1;
			agg.weight += b.votingPower;
			ballotsCast += 1;
		}
		return {
			family: 'count',
			eligibleCount: ctx.eligibleVoterCount,
			ballotsCast,
			options: [...byOption.values()]
		};
	},

	components: { ballot: 'SingleChoiceBallot', results: 'SingleChoiceResults' }
};
