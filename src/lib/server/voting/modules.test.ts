import { describe, it, expect } from 'vitest';
import type { BallotModule, BallotRecord, TallyContext, VoteContext } from './contracts';
import { singleChoiceModule } from './ballot-modules/single-choice';
import { consentModule, type ConsentSelection } from './ballot-modules/consent';
import { multiQuestionModule, mqOptionId } from './ballot-modules/multi-question';
import { registerBallotModule, getBallotModule, validateMethodBinding } from './registry';

const voteCtx = (frozenOptions: Array<{ optionId: string; group?: string }>): VoteContext => ({
	proposalId: 'p',
	phase: 'voting',
	voterEligible: true,
	frozenOptions
});

describe('single-choice validateVote rejections', () => {
	const ctx = voteCtx([{ optionId: 'A' }, { optionId: 'B' }]);
	it('rejects zero selections', () => {
		expect(singleChoiceModule.validateVote({ selections: [] }, ctx).ok).toBe(false);
	});
	it('rejects multiple selections', () => {
		expect(
			singleChoiceModule.validateVote({ selections: [{ choiceId: 'A' }, { choiceId: 'B' }] }, ctx)
				.ok
		).toBe(false);
	});
	it('rejects an off-ballot choice', () => {
		expect(singleChoiceModule.validateVote({ selections: [{ choiceId: 'Z' }] }, ctx).ok).toBe(
			false
		);
	});
	it('accepts one on-ballot choice', () => {
		expect(singleChoiceModule.validateVote({ selections: [{ choiceId: 'A' }] }, ctx).ok).toBe(true);
	});
});

describe('multi-question validateVote rejections', () => {
	const ctx = voteCtx([
		{ optionId: mqOptionId('q1', 'agree'), group: 'q1' },
		{ optionId: mqOptionId('q2', 'agree'), group: 'q2' }
	]);
	it('rejects an unknown question', () => {
		expect(
			multiQuestionModule.validateVote(
				{ selections: [{ questionId: 'qX', position: 'agree' }] },
				ctx
			).ok
		).toBe(false);
	});
	it('rejects a duplicate answer for one question', () => {
		const r = multiQuestionModule.validateVote(
			{
				selections: [
					{ questionId: 'q1', position: 'agree' },
					{ questionId: 'q1', position: 'disagree' }
				]
			},
			ctx
		);
		expect(r.ok).toBe(false);
	});
	it('rejects an empty ballot', () => {
		expect(multiQuestionModule.validateVote({ selections: [] }, ctx).ok).toBe(false);
	});
});

describe('consent aggregate', () => {
	it('records positions, reasons, and weights', () => {
		const ballots: BallotRecord<ConsentSelection>[] = [
			{ voterId: '1', votingPower: 2, selections: [{ position: 'consent' }], submittedAt: 0 },
			{
				voterId: '2',
				votingPower: 1,
				selections: [{ position: 'object', reason: 'no' }],
				submittedAt: 0
			}
		];
		const ctx: TallyContext = {
			config: {},
			phase: 'voting',
			eligibleVoterCount: 5,
			options: [],
			now: 0
		};
		const tally = consentModule.aggregate(ballots, ctx);
		expect(tally.family).toBe('consent');
		if (tally.family !== 'consent') return;
		expect(tally.ballotsCast).toBe(2);
		expect(tally.eligibleCount).toBe(5);
		expect(tally.positions.find((p) => p.position === 'consent')?.weight).toBe(2);
		expect(tally.positions.find((p) => p.position === 'object')?.reason).toBe('no');
	});
});

describe('registry extensibility (OCP)', () => {
	it('a newly registered module is usable and binds', () => {
		const fake: BallotModule = {
			id: 'test-only-ballot',
			tallyFamily: 'count',
			honoredKnobs: [],
			validateVote: () => ({ ok: true }),
			aggregate: () => ({ family: 'count', eligibleCount: 0, ballotsCast: 0, options: [] }),
			components: { ballot: '', results: '' }
		};
		registerBallotModule(fake);
		expect(getBallotModule('test-only-ballot')).toBe(fake);
		expect(
			validateMethodBinding({
				ballotModuleId: 'test-only-ballot',
				decisionRuleId: 'simple-majority',
				config: {}
			}).ok
		).toBe(true);
	});
});
