import type { BallotModule, DecisionRule, KnobId, MethodBinding } from './contracts';
import { singleChoiceModule } from './ballot-modules/single-choice';
import { consentModule } from './ballot-modules/consent';
import { multiQuestionModule } from './ballot-modules/multi-question';
import { simpleMajorityRule, absoluteMajorityRule, twoThirdsRule } from './decision-rules/majority';
import { consensusRule, consentRule, makeConsensusRule } from './decision-rules/consensus';
import { multiQuestionRule } from './decision-rules/multi-question';

// ── Registry A: ballot modules + decision rules (first-party, curated — design D2) ──────────────

const ballotModules = new Map<string, BallotModule>([
	[singleChoiceModule.id, singleChoiceModule as BallotModule],
	[consentModule.id, consentModule as BallotModule],
	[multiQuestionModule.id, multiQuestionModule as BallotModule]
]);

const decisionRules = new Map<string, DecisionRule>([
	[simpleMajorityRule.id, simpleMajorityRule],
	[absoluteMajorityRule.id, absoluteMajorityRule],
	[twoThirdsRule.id, twoThirdsRule],
	[consensusRule.id, consensusRule],
	[consentRule.id, consentRule],
	// consensus-minus-1 is a common preset; parameterized variants can be registered as needed.
	['consensus-minus-1', makeConsensusRule('consensus-minus-1', 1)],
	[multiQuestionRule.id, multiQuestionRule]
]);

export function getBallotModule(id: string): BallotModule | undefined {
	return ballotModules.get(id);
}
export function getDecisionRule(id: string): DecisionRule | undefined {
	return decisionRules.get(id);
}

// ── Binding validation (task 5.8 — methods declare honored knobs; reject bad combos) ────────────

export interface BindingValidation {
	ok: boolean;
	errors: string[];
}

export function validateMethodBinding(binding: MethodBinding): BindingValidation {
	const errors: string[] = [];
	const ballot = ballotModules.get(binding.ballotModuleId);
	const rule = decisionRules.get(binding.decisionRuleId);

	if (!ballot) errors.push(`Unknown ballot module '${binding.ballotModuleId}'.`);
	if (!rule) errors.push(`Unknown decision rule '${binding.decisionRuleId}'.`);

	if (ballot && rule && rule.accepts !== ballot.tallyFamily) {
		errors.push(
			`Decision rule '${rule.id}' accepts '${rule.accepts}' tallies but ballot '${ballot.id}' produces '${ballot.tallyFamily}'.`
		);
	}

	let fallback: DecisionRule | undefined;
	if (binding.fallbackRuleId) {
		fallback = decisionRules.get(binding.fallbackRuleId);
		if (!fallback) errors.push(`Unknown fallback rule '${binding.fallbackRuleId}'.`);
		if (rule && !rule.honoredKnobs.includes('fallbackRule')) {
			errors.push(`Decision rule '${rule.id}' does not support a fallback.`);
		}
		// A consent-family rule adapts its tally to `count` before escalating, so the fallback must
		// accept `count` tallies (cross-axis validity — task 6.8).
		if (rule && fallback && rule.accepts === 'consent' && fallback.accepts !== 'count') {
			errors.push(
				`Fallback '${fallback.id}' must accept 'count' tallies to escalate from consent (got '${fallback.accepts}').`
			);
		}
	}

	// Every configured knob must be honored by the ballot module or the decision rule.
	if (ballot && rule) {
		const honored = new Set<KnobId>([...ballot.honoredKnobs, ...rule.honoredKnobs]);
		for (const key of Object.keys(binding.config) as KnobId[]) {
			if (KNOB_IDS.has(key) && !honored.has(key)) {
				errors.push(`Knob '${key}' is not honored by ballot '${ballot.id}' or rule '${rule.id}'.`);
			}
		}
		// Cross-axis validity (design D-risk): a member-visible early stop needs a visible tally.
		if (
			binding.config.tallyRevealTiming === 'hidden-forever' &&
			binding.config.stopOnNthObjection != null
		) {
			errors.push('hidden-forever tally is incompatible with a member-visible stop-on-objection.');
		}
	}

	return { ok: errors.length === 0, errors };
}

const KNOB_IDS = new Set<KnobId>([
	'quorum',
	'passThreshold',
	'voteMutability',
	'ballotSecrecy',
	'tallyRevealTiming',
	'stopOnNthObjection',
	'absenceMeaning',
	'fallbackRule'
]);
