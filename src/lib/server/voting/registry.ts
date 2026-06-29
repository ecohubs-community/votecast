import type { BallotModule, DecisionRule, KnobId, MethodBinding } from './contracts';
import { singleChoiceModule } from './ballot-modules/single-choice';
import { consentModule } from './ballot-modules/consent';
import { multiQuestionModule } from './ballot-modules/multi-question';
import { simpleMajorityRule, absoluteMajorityRule, twoThirdsRule } from './decision-rules/majority';
import { consensusRule, consentRule, makeConsensusRule } from './decision-rules/consensus';
import { multiQuestionRule } from './decision-rules/multi-question';

// ── Registry A: ballot modules + decision rules (first-party, curated — design D2) ──────────────
// Open for extension via register*(): new modules/rules are added without editing the lookups below.

const ballotModules = new Map<string, BallotModule>();
const decisionRules = new Map<string, DecisionRule>();

export function registerBallotModule(module: BallotModule): void {
	ballotModules.set(module.id, module);
}
export function registerDecisionRule(rule: DecisionRule): void {
	decisionRules.set(rule.id, rule);
}
export function getBallotModule(id: string): BallotModule | undefined {
	return ballotModules.get(id);
}
export function getDecisionRule(id: string): DecisionRule | undefined {
	return decisionRules.get(id);
}

// Built-in registrations.
for (const module of [singleChoiceModule, consentModule, multiQuestionModule]) {
	registerBallotModule(module as BallotModule);
}
for (const rule of [
	simpleMajorityRule,
	absoluteMajorityRule,
	twoThirdsRule,
	consensusRule,
	consentRule,
	makeConsensusRule('consensus-minus-1', 1), // common preset; parameterized variants register as needed
	multiQuestionRule
]) {
	registerDecisionRule(rule);
}

// ── Binding validation (task 5.8) — decomposed into one focused check per concern (SRP) ─────────

export interface BindingValidation {
	ok: boolean;
	errors: string[];
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

function checkExistence(
	binding: MethodBinding,
	ballot?: BallotModule,
	rule?: DecisionRule,
	fallback?: DecisionRule
): string[] {
	const errors: string[] = [];
	if (!ballot) errors.push(`Unknown ballot module '${binding.ballotModuleId}'.`);
	if (!rule) errors.push(`Unknown decision rule '${binding.decisionRuleId}'.`);
	if (binding.fallbackRuleId && !fallback) {
		errors.push(`Unknown fallback rule '${binding.fallbackRuleId}'.`);
	}
	return errors;
}

function checkFamilyMatch(ballot?: BallotModule, rule?: DecisionRule): string[] {
	if (ballot && rule && rule.accepts !== ballot.tallyFamily) {
		return [
			`Decision rule '${rule.id}' accepts '${rule.accepts}' tallies but ballot '${ballot.id}' produces '${ballot.tallyFamily}'.`
		];
	}
	return [];
}

function checkFallback(rule?: DecisionRule, fallback?: DecisionRule): string[] {
	if (!fallback || !rule) return [];
	const errors: string[] = [];
	if (!rule.honoredKnobs.includes('fallbackRule')) {
		errors.push(`Decision rule '${rule.id}' does not support a fallback.`);
	}
	// A consent-family rule adapts its tally to `count` before escalating, so the fallback must
	// accept `count` tallies (cross-axis validity — task 6.8).
	if (rule.accepts === 'consent' && fallback.accepts !== 'count') {
		errors.push(
			`Fallback '${fallback.id}' must accept 'count' tallies to escalate from consent (got '${fallback.accepts}').`
		);
	}
	return errors;
}

function checkKnobs(binding: MethodBinding, ballot?: BallotModule, rule?: DecisionRule): string[] {
	if (!ballot || !rule) return [];
	const honored = new Set<KnobId>([...ballot.honoredKnobs, ...rule.honoredKnobs]);
	const errors: string[] = [];
	for (const key of Object.keys(binding.config) as KnobId[]) {
		if (KNOB_IDS.has(key) && !honored.has(key)) {
			errors.push(`Knob '${key}' is not honored by ballot '${ballot.id}' or rule '${rule.id}'.`);
		}
	}
	return errors;
}

function checkCrossAxis(binding: MethodBinding): string[] {
	// A member-visible early stop needs a visible tally (design D-risk).
	if (
		binding.config.tallyRevealTiming === 'hidden-forever' &&
		binding.config.stopOnNthObjection != null
	) {
		return ['hidden-forever tally is incompatible with a member-visible stop-on-objection.'];
	}
	return [];
}

export function validateMethodBinding(binding: MethodBinding): BindingValidation {
	const ballot = getBallotModule(binding.ballotModuleId);
	const rule = getDecisionRule(binding.decisionRuleId);
	const fallback = binding.fallbackRuleId ? getDecisionRule(binding.fallbackRuleId) : undefined;

	const errors = [
		...checkExistence(binding, ballot, rule, fallback),
		...checkFamilyMatch(ballot, rule),
		...checkFallback(rule, fallback),
		...checkKnobs(binding, ballot, rule),
		...checkCrossAxis(binding)
	];
	return { ok: errors.length === 0, errors };
}
