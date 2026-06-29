import type {
	CanonicalTally,
	DecisionRule,
	ResultEntry,
	ResultSet,
	TallyContext
} from '../contracts';
import { mqOptionId } from '../ballot-modules/multi-question';

/**
 * Multi-question (Common Ground) rule: each sub-question resolves independently (agree vs disagree,
 * `pass` ignored). There is no single pass/fail, so the top-level outcome is `recorded` and the
 * meaning lives in the per-question entries (design D9 — per-entry outcomes).
 */
export const multiQuestionRule: DecisionRule = {
	id: 'multi-question',
	accepts: 'multiQuestion',
	honoredKnobs: ['quorum'],
	resolve(tally: CanonicalTally, ctx: TallyContext): ResultSet {
		if (tally.family !== 'multiQuestion')
			throw new Error('multi-question requires a multiQuestion tally');

		const groups = new Map<string, { agree: number; disagree: number }>();
		for (const o of tally.options) {
			const group = o.group;
			if (!group) continue;
			const g = groups.get(group) ?? { agree: 0, disagree: 0 };
			if (o.optionId === mqOptionId(group, 'agree')) g.agree = o.weight;
			else if (o.optionId === mqOptionId(group, 'disagree')) g.disagree = o.weight;
			groups.set(group, g);
		}

		const labelByGroup = new Map(
			ctx.options.filter((o) => o.group).map((o) => [o.group as string, o.label ?? o.group!])
		);

		const entries: ResultEntry[] = [...groups.entries()].map(([group, g]) => ({
			key: group,
			label: labelByGroup.get(group) ?? group,
			outcome: g.agree > g.disagree ? 'passed' : g.agree < g.disagree ? 'failed' : 'tie',
			tallyForWeight: g.agree,
			tallyAgainstWeight: g.disagree
		}));

		return {
			outcome: 'recorded',
			entries,
			participation: {
				eligibleCount: tally.eligibleCount,
				ballotsCast: tally.ballotsCast,
				quorumMet: true
			}
		};
	}
};
