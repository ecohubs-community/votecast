import { describe, it, expect } from 'vitest';
import type { BallotRecord, TallyContext } from './contracts';
import { tallyBallots } from './dispatch';
import { mqOptionId } from './ballot-modules/multi-question';

// Result-correctness suite: proves the *tally outputs*, not just that the wiring runs.

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
const single = (rule: string) => ({
	ballotModuleId: 'single-choice',
	decisionRuleId: rule,
	config: {}
});
const ABC = [
	{ optionId: 'A', label: 'A' },
	{ optionId: 'B', label: 'B' },
	{ optionId: 'C', label: 'C' }
];

describe('weighted outcomes (the weight axis actually matters)', () => {
	it('a heavier minority beats a lighter majority', () => {
		// 1 voter with power 5 for A vs 3 voters power 1 for B → A wins by weight (5 > 3)
		const r = tallyBallots(
			single('simple-majority'),
			[
				ballot('1', [{ choiceId: 'A' }], 5),
				ballot('2', [{ choiceId: 'B' }]),
				ballot('3', [{ choiceId: 'B' }]),
				ballot('4', [{ choiceId: 'B' }])
			],
			tallyCtx(ABC, 4)
		);
		expect(r.outcome).toBe('passed');
		expect(r.entries.find((e) => e.key === 'A')?.outcome).toBe('passed');
		expect(r.entries.find((e) => e.key === 'A')?.tallyForWeight).toBe(5);
		expect(r.entries.find((e) => e.key === 'B')?.tallyForWeight).toBe(3);
	});

	it('weight is conserved: entry weights sum to total cast power', () => {
		const r = tallyBallots(
			single('simple-majority'),
			[ballot('1', [{ choiceId: 'A' }], 2), ballot('2', [{ choiceId: 'B' }], 3)],
			tallyCtx(ABC, 2)
		);
		const sum = r.entries.reduce((s, e) => s + e.tallyForWeight, 0);
		expect(sum).toBe(5);
	});
});

describe('absolute majority (> 50%, strict)', () => {
	it('passes above half', () => {
		const r = tallyBallots(
			single('absolute-majority'),
			[ballot('1', [{ choiceId: 'A' }], 3), ballot('2', [{ choiceId: 'B' }])],
			tallyCtx(ABC, 2)
		);
		expect(r.outcome).toBe('passed'); // 3/4 = 75%
	});
	it('a plurality at exactly 50% does NOT pass', () => {
		const r = tallyBallots(
			single('absolute-majority'),
			[
				ballot('1', [{ choiceId: 'A' }]),
				ballot('2', [{ choiceId: 'A' }]),
				ballot('3', [{ choiceId: 'B' }]),
				ballot('4', [{ choiceId: 'C' }])
			],
			tallyCtx(ABC, 4)
		);
		expect(r.outcome).toBe('failed'); // A = 2/4 = 50%, not strictly greater
	});
});

describe('super majority (>= 2/3) standalone, at the boundary', () => {
	it('exactly two-thirds passes', () => {
		const r = tallyBallots(
			single('super-majority'),
			[ballot('1', [{ choiceId: 'A' }], 2), ballot('2', [{ choiceId: 'B' }])],
			tallyCtx(ABC, 2)
		);
		expect(r.outcome).toBe('passed'); // 2/3 exactly
	});
	it('just below two-thirds fails', () => {
		const r = tallyBallots(
			single('super-majority'),
			[ballot('1', [{ choiceId: 'A' }], 3), ballot('2', [{ choiceId: 'B' }], 2)],
			tallyCtx(ABC, 2)
		);
		expect(r.outcome).toBe('failed'); // 3/5 = 60%
	});
});

describe('absenceMeaning: silence = consent (the consensus bylaw)', () => {
	const consensus = (config: Record<string, unknown>) => ({
		ballotModuleId: 'consent',
		decisionRuleId: 'consensus',
		config
	});
	it('absent eligible members do not block and quorum is bypassed', () => {
		// 10 eligible, only 1 consents, nobody objects → passes (silence = consent)
		const r = tallyBallots(
			consensus({ absenceMeaning: 'consent', quorum: 0.9 }),
			[ballot('1', [{ position: 'consent' }])],
			tallyCtx([], 10)
		);
		expect(r.outcome).toBe('passed');
	});
	it('an objection still blocks even under silence = consent', () => {
		const r = tallyBallots(
			consensus({ absenceMeaning: 'consent' }),
			[ballot('1', [{ position: 'object', reason: 'violates vision' }])],
			tallyCtx([], 10)
		);
		expect(r.outcome).toBe('blocked');
	});
	it('without silence = consent, low turnout is quorum-not-met', () => {
		const r = tallyBallots(
			consensus({ quorum: 0.9 }),
			[ballot('1', [{ position: 'consent' }])],
			tallyCtx([], 10)
		);
		expect(r.outcome).toBe('quorum-not-met');
	});
});

describe('quorum forms and boundary', () => {
	const withQuorum = {
		ballotModuleId: 'single-choice',
		decisionRuleId: 'simple-majority',
		config: { quorum: 2 }
	};
	it('absolute-count quorum: exactly met passes the gate', () => {
		const r = tallyBallots(
			withQuorum,
			[ballot('1', [{ choiceId: 'A' }]), ballot('2', [{ choiceId: 'A' }])],
			tallyCtx(ABC, 100) // need 2 ballots, have 2
		);
		expect(r.outcome).toBe('passed');
	});
	it('absolute-count quorum: one short fails the gate', () => {
		const r = tallyBallots(withQuorum, [ballot('1', [{ choiceId: 'A' }])], tallyCtx(ABC, 100));
		expect(r.outcome).toBe('quorum-not-met');
	});
});

describe('result-set integrity', () => {
	it('includes every ballot option, marks losers failed, and is empty-safe', () => {
		const r = tallyBallots(
			single('simple-majority'),
			[
				ballot('1', [{ choiceId: 'A' }]),
				ballot('2', [{ choiceId: 'A' }]),
				ballot('3', [{ choiceId: 'B' }])
			],
			tallyCtx(ABC, 3)
		);
		expect(r.entries.map((e) => e.key).sort()).toEqual(['A', 'B', 'C']);
		expect(r.entries.find((e) => e.key === 'B')?.outcome).toBe('failed');
		expect(r.entries.find((e) => e.key === 'C')?.tallyForWeight).toBe(0); // on the ballot, zero votes
	});
	it('no ballots at all is indeterminate', () => {
		const r = tallyBallots(single('simple-majority'), [], tallyCtx(ABC, 5));
		expect(r.outcome).toBe('indeterminate');
		expect(r.participation.ballotsCast).toBe(0);
	});
});

describe('multi-question correctness', () => {
	const method = { ballotModuleId: 'multi-question', decisionRuleId: 'multi-question', config: {} };
	const opts = [
		{ optionId: mqOptionId('q1', 'agree'), group: 'q1', label: 'Q1' },
		{ optionId: mqOptionId('q1', 'disagree'), group: 'q1', label: 'Q1' }
	];
	it('weight decides each question; pass is ignored', () => {
		const r = tallyBallots(
			method,
			[
				ballot('1', [{ questionId: 'q1', position: 'agree' }], 3),
				ballot('2', [{ questionId: 'q1', position: 'disagree' }], 1),
				ballot('3', [{ questionId: 'q1', position: 'pass' }], 10) // must not tip the result
			],
			tallyCtx(opts, 3)
		);
		const q1 = r.entries.find((e) => e.key === 'q1');
		expect(q1?.outcome).toBe('passed'); // 3 agree vs 1 disagree; the power-10 pass is ignored
		expect(q1?.tallyForWeight).toBe(3);
		expect(q1?.tallyAgainstWeight).toBe(1);
	});
});
