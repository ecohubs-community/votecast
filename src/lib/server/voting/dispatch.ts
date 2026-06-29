import type {
	BallotRecord,
	MethodBinding,
	ResultSet,
	TallyContext,
	VoteContext,
	VoteValidation
} from './contracts';
import { getBallotModule, getDecisionRule } from './registry';

/** The onePersonOneVote equivalent — single-choice ballot + simple-majority rule. */
export const DEFAULT_METHOD: MethodBinding = {
	ballotModuleId: 'single-choice',
	decisionRuleId: 'simple-majority',
	config: {}
};

/** Validate one voter's submission against the bound ballot module, including vote mutability (D8). */
export function validateSubmission(
	binding: MethodBinding,
	submission: unknown,
	ctx: VoteContext
): VoteValidation {
	const ballot = getBallotModule(binding.ballotModuleId);
	if (!ballot) return { ok: false, reason: `Unknown ballot module '${binding.ballotModuleId}'.` };

	// Mutability: a recast is only allowed when the method permits it (default: allowed while open).
	if (ctx.existingBallotAt != null && binding.config.voteMutability === false) {
		return { ok: false, reason: 'Your vote is final and cannot be changed.' };
	}
	return ballot.validateVote(submission, ctx);
}

/** Run the full tally: ballot module aggregates → decision rule resolves (with optional fallback). */
export function tallyBallots(
	binding: MethodBinding,
	ballots: BallotRecord[],
	ctx: TallyContext
): ResultSet {
	const ballot = getBallotModule(binding.ballotModuleId);
	const rule = getDecisionRule(binding.decisionRuleId);
	if (!ballot) throw new Error(`Unknown ballot module '${binding.ballotModuleId}'.`);
	if (!rule) throw new Error(`Unknown decision rule '${binding.decisionRuleId}'.`);

	const fallback = binding.fallbackRuleId ? getDecisionRule(binding.fallbackRuleId) : undefined;
	// The method binding's config is authoritative — thread it into the context the module/rule read.
	const ctxWithConfig: TallyContext = { ...ctx, config: binding.config };
	const tally = ballot.aggregate(ballots, ctxWithConfig);
	return rule.resolve(tally, ctxWithConfig, fallback);
}
