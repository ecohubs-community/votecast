import type {
	CanonicalTally,
	DecisionRule,
	ResultEntry,
	ResultSet,
	TallyContext
} from '../contracts';
import { quorumMet } from './majority';

// Approval family over a `count` tally: unlike plurality (which just names the option with the most
// votes), approval knows one option means "approve" and resolves a TRUE pass/fail. The approve option
// is position 0 and reject is position 1 (label-independent); any further options (e.g. Abstain) are
// present-but-not-deciding — they count toward quorum but not the approve/reject share.

/** The optionId at a given ballot position (falls back to positional order if `position` is unset). */
function optionAt(ctx: TallyContext, pos: number): string | undefined {
	const exact = ctx.options.find((o) => o.position === pos);
	if (exact) return exact.optionId;
	return [...ctx.options].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[pos]?.optionId;
}

function labelFor(optionId: string | undefined, ctx: TallyContext): string {
	return ctx.options.find((o) => o.optionId === optionId)?.label ?? optionId ?? '';
}

/**
 * @param threshold approve share required to pass (of decisive = approve + reject weight).
 * @param inclusive `true` → `>= threshold` (super-majority); `false` → `> threshold` (majority).
 */
export function makeApprovalRule(id: string, threshold: number, inclusive: boolean): DecisionRule {
	return {
		id,
		accepts: 'count',
		honoredKnobs: ['quorum', 'passThreshold'],
		resolve(tally: CanonicalTally, ctx: TallyContext): ResultSet {
			if (tally.family !== 'count') throw new Error(`${id} requires a count tally`);

			const approveId = optionAt(ctx, 0);
			const rejectId = optionAt(ctx, 1);
			const weightOf = (oid?: string) => tally.options.find((o) => o.optionId === oid)?.weight ?? 0;
			const approve = weightOf(approveId);
			const reject = weightOf(rejectId);
			const decisive = approve + reject;

			const participation = {
				eligibleCount: tally.eligibleCount,
				ballotsCast: tally.ballotsCast,
				quorumMet: quorumMet(tally, ctx)
			};

			const required =
				typeof ctx.config.passThreshold === 'number' ? ctx.config.passThreshold : threshold;
			const share = decisive > 0 ? approve / decisive : 0;
			const passes = decisive > 0 && (inclusive ? share >= required : share > required);
			const decided = participation.quorumMet && decisive > 0;

			const entries: ResultEntry[] = tally.options.map((o) => {
				const outcome: ResultEntry['outcome'] = !decided
					? 'recorded'
					: o.optionId === approveId
						? passes
							? 'passed'
							: 'failed'
						: o.optionId === rejectId
							? passes
								? 'failed'
								: 'passed'
							: 'recorded';
				return {
					key: o.optionId,
					label: labelFor(o.optionId, ctx),
					outcome,
					tallyForWeight: o.weight
				};
			});

			if (!participation.quorumMet) return { outcome: 'quorum-not-met', entries, participation };
			if (decisive === 0) return { outcome: 'indeterminate', entries, participation };
			return { outcome: passes ? 'passed' : 'failed', entries, participation };
		}
	};
}

export const approvalMajorityRule = makeApprovalRule('approval-majority', 0.5, false);
export const approvalSuperRule = makeApprovalRule('approval-super', 2 / 3, true);
