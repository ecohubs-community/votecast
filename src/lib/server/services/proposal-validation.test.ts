import { describe, it, expect } from 'vitest';
import { resolveQuestionContributionPolicy } from './proposal-validation';

describe('resolveQuestionContributionPolicy', () => {
	it('returns null policy for a non-multi-question ballot', () => {
		expect(
			resolveQuestionContributionPolicy(false, { questionContributors: 'members' }, {})
		).toEqual({ questionContributors: null, questionContributionPhase: null });
	});

	it('defaults to proposer-at-creation with no type defaults or override', () => {
		expect(resolveQuestionContributionPolicy(true, null, {})).toEqual({
			questionContributors: 'proposer',
			questionContributionPhase: 'creation'
		});
	});

	it('uses the type defaults when the proposer gives no override', () => {
		expect(
			resolveQuestionContributionPolicy(
				true,
				{ questionContributors: 'members', questionContributionPhase: 'deliberation' },
				{}
			)
		).toEqual({ questionContributors: 'members', questionContributionPhase: 'deliberation' });
	});

	it('honors the proposer override when the type is unlocked', () => {
		expect(
			resolveQuestionContributionPolicy(
				true,
				{
					questionContributors: 'proposer',
					questionContributionPhase: 'creation',
					lockQuestionContribution: false
				},
				{ questionContributors: 'members', questionContributionPhase: 'deliberation' }
			)
		).toEqual({ questionContributors: 'members', questionContributionPhase: 'deliberation' });
	});

	it('ignores the proposer override when the type is locked', () => {
		expect(
			resolveQuestionContributionPolicy(
				true,
				{
					questionContributors: 'proposer',
					questionContributionPhase: 'creation',
					lockQuestionContribution: true
				},
				{ questionContributors: 'members', questionContributionPhase: 'deliberation' }
			)
		).toEqual({ questionContributors: 'proposer', questionContributionPhase: 'creation' });
	});
});
