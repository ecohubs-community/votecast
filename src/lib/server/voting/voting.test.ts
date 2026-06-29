import { describe, it, expect } from 'vitest';
import type { BallotRecord, TallyContext, VoteContext } from './contracts';
import { tallyBallots, validateSubmission, DEFAULT_METHOD } from './dispatch';
import { validateMethodBinding } from './registry';
import { consentModule } from './ballot-modules/consent';
import { mqOptionId } from './ballot-modules/multi-question';
import { isEligible } from './eligibility';
import { resolveVotingPower } from './weight';

function ballot(voterId: string, selections: unknown[], votingPower = 1): BallotRecord {
	return { voterId, votingPower, selections, submittedAt: 0 };
}
function tallyCtx(
	options: Array<{ optionId: string; group?: string; label?: string }>,
	eligibleVoterCount: number,
	config: Record<string, unknown> = {}
): TallyContext {
	return { config, phase: 'voting', eligibleVoterCount, options, now: 0 };
}
const AB = [
	{ optionId: 'A', label: 'A' },
	{ optionId: 'B', label: 'B' }
];

describe('single-choice + simple-majority', () => {
	const method = DEFAULT_METHOD;
	it('plurality winner passes', () => {
		const r = tallyBallots(
			method,
			[
				ballot('1', [{ choiceId: 'A' }]),
				ballot('2', [{ choiceId: 'A' }]),
				ballot('3', [{ choiceId: 'B' }])
			],
			tallyCtx(AB, 3)
		);
		expect(r.outcome).toBe('passed');
		expect(r.entries.find((e) => e.key === 'A')?.outcome).toBe('passed');
	});
	it('equal top is a tie', () => {
		const r = tallyBallots(
			method,
			[ballot('1', [{ choiceId: 'A' }]), ballot('2', [{ choiceId: 'B' }])],
			tallyCtx(AB, 2)
		);
		expect(r.outcome).toBe('tie');
	});
	it('below quorum is quorum-not-met', () => {
		const r = tallyBallots(
			{
				ballotModuleId: 'single-choice',
				decisionRuleId: 'simple-majority',
				config: { quorum: 0.5 }
			},
			[ballot('1', [{ choiceId: 'A' }])],
			tallyCtx(AB, 10)
		);
		expect(r.outcome).toBe('quorum-not-met');
	});
});

describe('consent + consensus', () => {
	const consensus = { ballotModuleId: 'consent', decisionRuleId: 'consensus', config: {} };
	const ctx = tallyCtx([], 3);
	it('no objection passes', () => {
		const r = tallyBallots(
			consensus,
			[ballot('1', [{ position: 'consent' }]), ballot('2', [{ position: 'stand-aside' }])],
			ctx
		);
		expect(r.outcome).toBe('passed');
	});
	it('a reasoned objection blocks', () => {
		const r = tallyBallots(
			consensus,
			[
				ballot('1', [{ position: 'consent' }]),
				ballot('2', [{ position: 'object', reason: 'violates vision' }])
			],
			ctx
		);
		expect(r.outcome).toBe('blocked');
	});
	it('stand-aside alone does not block', () => {
		const r = tallyBallots(consensus, [ballot('1', [{ position: 'stand-aside' }])], ctx);
		expect(r.outcome).toBe('passed');
	});
	it('consensus-minus-1 tolerates one objection', () => {
		const minus1 = { ...consensus, decisionRuleId: 'consensus-minus-1' };
		const one = tallyBallots(minus1, [ballot('1', [{ position: 'object', reason: 'x' }])], ctx);
		expect(one.outcome).toBe('passed');
		const two = tallyBallots(
			minus1,
			[
				ballot('1', [{ position: 'object', reason: 'x' }]),
				ballot('2', [{ position: 'object', reason: 'y' }])
			],
			ctx
		);
		expect(two.outcome).toBe('blocked');
	});
	it('objection without a reason is rejected at validation', () => {
		const vctx: VoteContext = {
			proposalId: 'p',
			phase: 'voting',
			voterEligible: true,
			frozenOptions: []
		};
		expect(consentModule.validateVote({ selections: [{ position: 'object' }] }, vctx).ok).toBe(
			false
		);
		expect(
			consentModule.validateVote({ selections: [{ position: 'object', reason: 'why' }] }, vctx).ok
		).toBe(true);
	});
});

describe('sociocracy: consent with a 2/3 fallback (Gate-1 composition)', () => {
	const method = {
		ballotModuleId: 'consent',
		decisionRuleId: 'consensus',
		fallbackRuleId: 'super-majority',
		config: {}
	};
	const ctx = tallyCtx([], 4);
	it('blocked consensus escalates and passes at ≥2/3 consent', () => {
		const r = tallyBallots(
			method,
			[
				ballot('1', [{ position: 'consent' }]),
				ballot('2', [{ position: 'consent' }]),
				ballot('3', [{ position: 'consent' }]),
				ballot('4', [{ position: 'object', reason: 'no' }])
			],
			ctx
		);
		expect(r.outcome).toBe('passed'); // 3/4 consent ≥ 2/3
	});
	it('escalation fails below 2/3', () => {
		const r = tallyBallots(
			method,
			[
				ballot('1', [{ position: 'consent' }]),
				ballot('2', [{ position: 'consent' }]),
				ballot('3', [{ position: 'consent' }]),
				ballot('4', [{ position: 'object', reason: 'no' }]),
				ballot('5', [{ position: 'object', reason: 'no' }])
			],
			tallyCtx([], 5)
		);
		expect(r.outcome).toBe('failed'); // 3/5 consent < 2/3, and not a tie
	});
});

describe('multi-question (Common Ground)', () => {
	const method = { ballotModuleId: 'multi-question', decisionRuleId: 'multi-question', config: {} };
	const options = [
		{ optionId: mqOptionId('q1', 'agree'), group: 'q1', label: 'Build it?' },
		{ optionId: mqOptionId('q1', 'disagree'), group: 'q1', label: 'Build it?' },
		{ optionId: mqOptionId('q2', 'agree'), group: 'q2', label: 'Fund from reserves?' },
		{ optionId: mqOptionId('q2', 'disagree'), group: 'q2', label: 'Fund from reserves?' }
	];
	it('resolves each question independently with a recorded top-level', () => {
		const r = tallyBallots(
			method,
			[
				ballot('1', [
					{ questionId: 'q1', position: 'agree' },
					{ questionId: 'q2', position: 'disagree' }
				]),
				ballot('2', [
					{ questionId: 'q1', position: 'agree' },
					{ questionId: 'q2', position: 'agree' }
				])
			],
			tallyCtx(options, 2)
		);
		expect(r.outcome).toBe('recorded');
		expect(r.entries.find((e) => e.key === 'q1')?.outcome).toBe('passed');
		expect(r.entries.find((e) => e.key === 'q2')?.outcome).toBe('tie');
	});
});

describe('binding validation (task 5.8)', () => {
	it('accepts the default method', () => {
		expect(validateMethodBinding(DEFAULT_METHOD).ok).toBe(true);
	});
	it('rejects a ballot/rule family mismatch', () => {
		expect(
			validateMethodBinding({
				ballotModuleId: 'single-choice',
				decisionRuleId: 'consensus',
				config: {}
			}).ok
		).toBe(false);
	});
	it('rejects a knob the method does not honor', () => {
		const r = validateMethodBinding({
			ballotModuleId: 'single-choice',
			decisionRuleId: 'simple-majority',
			config: { absenceMeaning: 'consent' }
		});
		expect(r.ok).toBe(false);
	});
	it('rejects hidden-forever tally with a member-visible early stop', () => {
		const r = validateMethodBinding({
			ballotModuleId: 'consent',
			decisionRuleId: 'consensus',
			config: { tallyRevealTiming: 'hidden-forever', stopOnNthObjection: 1 }
		});
		expect(r.ok).toBe(false);
	});
});

describe('mutability + eligibility + weight', () => {
	it('rejects a recast when the method is immutable', () => {
		const ctx: VoteContext = {
			proposalId: 'p',
			phase: 'voting',
			voterEligible: true,
			frozenOptions: AB,
			existingBallotAt: 123
		};
		const immutable = { ...DEFAULT_METHOD, config: { voteMutability: false } };
		expect(validateSubmission(immutable, { selections: [{ choiceId: 'A' }] }, ctx).ok).toBe(false);
		expect(validateSubmission(DEFAULT_METHOD, { selections: [{ choiceId: 'A' }] }, ctx).ok).toBe(
			true
		);
	});
	it('trained eligibility needs the training flag; all-members does not', () => {
		expect(isEligible({ kind: 'all-members' }, { isMember: true })).toBe(true);
		expect(isEligible({ kind: 'trained' }, { isMember: true })).toBe(false);
		expect(isEligible({ kind: 'trained' }, { isMember: true, isTrained: true })).toBe(true);
	});
	it('one-person-one-vote weight is 1', () => {
		expect(resolveVotingPower({ kind: 'one-person-one-vote' })).toBe(1);
	});
});
