// Shared mapping for the lifecycle phase → human label + badge style variant (reuses the existing
// vc-badge--draft/active/closed styling). Single source so the badge and cards stay consistent.

export type ProposalPhase = 'draft' | 'deliberation' | 'voting' | 'objection-window' | 'finalized';

export const PHASE_LABEL: Record<ProposalPhase, string> = {
	draft: 'Draft',
	deliberation: 'Deliberation',
	voting: 'Voting open',
	'objection-window': 'Objection window',
	finalized: 'Closed'
};

export const PHASE_VARIANT: Record<ProposalPhase, 'draft' | 'active' | 'closed'> = {
	draft: 'draft',
	deliberation: 'draft',
	voting: 'active',
	'objection-window': 'active',
	finalized: 'closed'
};

/** Voting has not started yet (badge/time copy reads "opens", results hidden). */
export function isUpcoming(phase: ProposalPhase): boolean {
	return phase === 'draft' || phase === 'deliberation';
}
