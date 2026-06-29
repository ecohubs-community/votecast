import type {
	CanonicalTally,
	DecisionRule,
	ResultEntry,
	ResultSet,
	TallyContext
} from '../contracts';

/** Resolve the quorum requirement (fraction of eligible if ≤1, else an absolute ballot count). */
export function quorumMet(
	tally: { eligibleCount: number; ballotsCast: number },
	ctx: TallyContext
): boolean {
	const q = ctx.config.quorum;
	if (typeof q !== 'number' || q <= 0) return true;
	const required = q <= 1 ? Math.ceil(q * tally.eligibleCount) : q;
	return tally.ballotsCast >= required;
}

function labelFor(optionId: string, ctx: TallyContext): string {
	return ctx.options.find((o) => o.optionId === optionId)?.label ?? optionId;
}

type MajorityMode = 'plurality' | 'absolute' | { superFraction: number };

/**
 * Majority family over a `count` tally.
 * - plurality: most weight wins (`tie` if the top two are equal).
 * - absolute: winner needs > 50% of cast weight.
 * - super: winner needs ≥ the configured fraction (e.g. 2/3).
 * If the threshold is unmet and a fallback is provided, the fallback resolves instead.
 */
export function makeMajorityRule(id: string, mode: MajorityMode): DecisionRule {
	return {
		id,
		accepts: 'count',
		honoredKnobs: ['quorum', 'passThreshold'],
		resolve(tally: CanonicalTally, ctx: TallyContext, fallback): ResultSet {
			if (tally.family !== 'count') throw new Error(`${id} requires a count tally`);
			const totalWeight = tally.options.reduce((s, o) => s + o.weight, 0);
			const participation = {
				eligibleCount: tally.eligibleCount,
				ballotsCast: tally.ballotsCast,
				quorumMet: quorumMet(tally, ctx)
			};
			const sorted = [...tally.options].sort((a, b) => b.weight - a.weight);
			const top = sorted[0];

			const baseEntries = (winnerId?: string): ResultEntry[] =>
				sorted.map((o) => ({
					key: o.optionId,
					label: labelFor(o.optionId, ctx),
					outcome: o.optionId === winnerId ? 'passed' : 'failed',
					tallyForWeight: o.weight
				}));

			if (!participation.quorumMet) {
				return { outcome: 'quorum-not-met', entries: baseEntries(), participation };
			}
			if (!top || totalWeight === 0) {
				return { outcome: 'indeterminate', entries: baseEntries(), participation };
			}
			const tie = sorted[1] !== undefined && sorted[1].weight === top.weight;

			if (mode === 'plurality') {
				if (tie) return { outcome: 'tie', entries: baseEntries(), participation };
				return { outcome: 'passed', entries: baseEntries(top.optionId), participation };
			}

			const required = mode === 'absolute' ? 0.5 : mode.superFraction;
			const fraction = top.weight / totalWeight;
			const passes = mode === 'absolute' ? fraction > required : fraction >= required;
			if (passes && !tie) {
				return { outcome: 'passed', entries: baseEntries(top.optionId), participation };
			}
			if (fallback) return fallback.resolve(tally, ctx);
			return { outcome: tie ? 'tie' : 'failed', entries: baseEntries(), participation };
		}
	};
}

export const simpleMajorityRule = makeMajorityRule('simple-majority', 'plurality');
export const absoluteMajorityRule = makeMajorityRule('absolute-majority', 'absolute');
export const twoThirdsRule = makeMajorityRule('super-majority', { superFraction: 2 / 3 });
