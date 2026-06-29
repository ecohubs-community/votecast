import { describe, it, expect } from 'vitest';
import { computePhase, isVotingOpen, type PhaseTiming } from './proposal-phase';

const HOUR = 3_600_000;
const base = (over: Partial<PhaseTiming> = {}): PhaseTiming => ({
	startTime: new Date(1000 * HOUR),
	endTime: new Date(1010 * HOUR),
	deliberationSeconds: 0,
	objectionWindowSeconds: 0,
	...over
});

describe('computePhase', () => {
	it('no deliberation, no objection window: draft → voting → finalized', () => {
		const t = base();
		expect(computePhase(t, 999 * HOUR)).toBe('draft');
		expect(computePhase(t, 1000 * HOUR)).toBe('voting'); // at startTime
		expect(computePhase(t, 1005 * HOUR)).toBe('voting');
		expect(computePhase(t, 1010 * HOUR)).toBe('finalized'); // at endTime, no window
		expect(computePhase(t, 2000 * HOUR)).toBe('finalized');
	});

	it('with deliberation: draft before the window, then deliberation, then voting', () => {
		const t = base({ deliberationSeconds: 2 * 3600 }); // 2h deliberation ending at startTime
		expect(computePhase(t, 997 * HOUR)).toBe('draft'); // before deliberation starts (998h)
		expect(computePhase(t, 998 * HOUR)).toBe('deliberation'); // at deliberation start
		expect(computePhase(t, 999 * HOUR)).toBe('deliberation');
		expect(computePhase(t, 1000 * HOUR)).toBe('voting');
	});

	it('with objection window: objection-window between endTime and end+window, then finalized', () => {
		const t = base({ objectionWindowSeconds: 3 * 3600 }); // 3h window after endTime
		expect(computePhase(t, 1009 * HOUR)).toBe('voting');
		expect(computePhase(t, 1010 * HOUR)).toBe('objection-window'); // at endTime
		expect(computePhase(t, 1012 * HOUR)).toBe('objection-window');
		expect(computePhase(t, 1013 * HOUR)).toBe('finalized'); // at end + window
		expect(computePhase(t, 1014 * HOUR)).toBe('finalized');
	});

	it('full lifecycle with both deliberation and objection window', () => {
		const t = base({ deliberationSeconds: 3600, objectionWindowSeconds: 3600 });
		expect(computePhase(t, 998 * HOUR)).toBe('draft');
		expect(computePhase(t, 999.5 * HOUR)).toBe('deliberation');
		expect(computePhase(t, 1005 * HOUR)).toBe('voting');
		expect(computePhase(t, 1010.5 * HOUR)).toBe('objection-window');
		expect(computePhase(t, 1011 * HOUR)).toBe('finalized');
	});
});

describe('isVotingOpen', () => {
	it('is true only during the voting phase', () => {
		expect(isVotingOpen('voting')).toBe(true);
		for (const p of ['draft', 'deliberation', 'objection-window', 'finalized'] as const) {
			expect(isVotingOpen(p)).toBe(false);
		}
	});
});
