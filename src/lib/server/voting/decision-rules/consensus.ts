import type {
	CanonicalTally,
	DecisionRule,
	ResultEntry,
	ResultSet,
	TallyContext
} from '../contracts';
import { quorumMet } from './majority';

/**
 * Consensus family over a `consent` tally.
 * - consensus: blocks if any reasoned objection (minusN = 0).
 * - consensus-minus-N: blocks only if objections exceed N.
 * When blocked and a fallback is provided, the consent tally is adapted to a count tally
 * (consent = for, object = against, stand-aside = abstain/excluded) and the fallback resolves it —
 * this is how "sociocracy with a 2/3 fallback" composes (design D2 Gate-1 finding).
 */
export function makeConsensusRule(id: string, minusN = 0): DecisionRule {
	return {
		id,
		accepts: 'consent',
		honoredKnobs: ['quorum', 'absenceMeaning', 'stopOnNthObjection', 'fallbackRule'],
		resolve(tally: CanonicalTally, ctx: TallyContext, fallback): ResultSet {
			if (tally.family !== 'consent') throw new Error(`${id} requires a consent tally`);
			const absenceMeaning = ctx.config.absenceMeaning === 'consent' ? 'consent' : 'ignore';

			const objectors = tally.positions.filter((p) => p.position === 'object');
			const consents = tally.positions.filter((p) => p.position === 'consent');
			const standAsides = tally.positions.filter((p) => p.position === 'stand-aside');
			const forWeight = consents.reduce((s, p) => s + p.weight, 0);
			const againstWeight = objectors.reduce((s, p) => s + p.weight, 0);

			// Silence = consent (absent eligible counted as consenting) vs. ignored (quorum applies).
			const quorumOk = absenceMeaning === 'consent' ? true : quorumMet(tally, ctx);
			const participation = {
				eligibleCount: tally.eligibleCount,
				ballotsCast: tally.ballotsCast,
				quorumMet: quorumOk
			};

			const entries: ResultEntry[] = [
				{ key: 'consent', label: 'Consent', outcome: 'passed', tallyForWeight: forWeight },
				{
					key: 'object',
					label: 'Object',
					outcome: 'failed',
					tallyForWeight: againstWeight,
					detail: { objections: objectors.map((o) => o.reason).filter(Boolean) }
				},
				{
					key: 'stand-aside',
					label: 'Stand aside',
					outcome: 'recorded',
					tallyForWeight: standAsides.reduce((s, p) => s + p.weight, 0)
				}
			];

			if (!quorumOk) return { outcome: 'quorum-not-met', entries, participation };

			const blocked = objectors.length > minusN;
			if (!blocked) return { outcome: 'passed', entries, participation };

			if (fallback) {
				// Adapt to a count tally (stand-asides excluded from the denominator) and escalate.
				const adapted: CanonicalTally = {
					family: 'count',
					eligibleCount: tally.eligibleCount,
					ballotsCast: consents.length + objectors.length,
					options: [
						{ optionId: 'consent', count: consents.length, weight: forWeight },
						{ optionId: 'object', count: objectors.length, weight: againstWeight }
					]
				};
				const adaptedCtx: TallyContext = {
					...ctx,
					options: [
						{ optionId: 'consent', label: 'Consent' },
						{ optionId: 'object', label: 'Object' }
					]
				};
				return fallback.resolve(adapted, adaptedCtx);
			}
			return { outcome: 'blocked', entries, participation };
		}
	};
}

export const consensusRule = makeConsensusRule('consensus', 0);
export const consentRule = makeConsensusRule('consent', 0);
