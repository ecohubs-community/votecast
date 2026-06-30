// Pure lifecycle-phase computation (no imports → safe for any module, breaks import cycles).

/** Lifecycle phase — where a proposal is in its process (design D7). Matches the `proposals.phase` enum. */
export type ProposalPhase = 'draft' | 'deliberation' | 'voting' | 'objection-window' | 'finalized';

export interface PhaseTiming {
	startTime: Date; // voting opens
	endTime: Date; // voting closes
	deliberationSeconds: number; // length of the pre-voting deliberation window (0 = none)
	objectionWindowSeconds: number; // async objection window after voting closes (0 = none)
}

/**
 * Pure phase computation from a method's timing (design D7). The deliberation window ends at
 * `startTime` (so it spans `[startTime - deliberation, startTime)`); the objection window follows
 * `endTime`. No side effects — trivially testable.
 *
 *   draft → deliberation → voting → objection-window → finalized
 */
export function computePhase(timing: PhaseTiming, now: number): ProposalPhase {
	const start = timing.startTime.getTime();
	const end = timing.endTime.getTime();
	const objectionEnd = end + timing.objectionWindowSeconds * 1000;
	const deliberationStart = start - timing.deliberationSeconds * 1000;

	if (now >= objectionEnd) return 'finalized';
	if (now >= end) return timing.objectionWindowSeconds > 0 ? 'objection-window' : 'finalized';
	if (now >= start) return 'voting';
	if (timing.deliberationSeconds > 0 && now >= deliberationStart) return 'deliberation';
	return 'draft';
}

/** True while members may submit ballots (votes are only accepted during the voting phase). */
export function isVotingOpen(phase: ProposalPhase): boolean {
	return phase === 'voting';
}
