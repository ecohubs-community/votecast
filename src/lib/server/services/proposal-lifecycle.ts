import { eq } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import { proposal } from '$lib/server/db/schema';
import { emit } from '../events';
import { aggregateResults } from './proposal-results';
import { resolveProposalPhase } from './proposal-phase';
import type { Database } from './types';

export type ProposalRecord = typeof proposal.$inferSelect;

/**
 * Lazily transition a proposal's lifecycle PHASE from the current time + its method timing
 * (deliberation → voting → objection-window → finalized). Persists the new phase and emits the
 * matching lifecycle events. Called on single-proposal reads (getProposal, vote, results).
 */
export async function transitionProposalStatus(
	p: ProposalRecord,
	db: Database = defaultDb
): Promise<ProposalRecord> {
	const now = Date.now();
	const newPhase = await resolveProposalPhase(p, now, db);
	if (newPhase === p.phase) return p;

	const prev = p.phase;
	await db.update(proposal).set({ phase: newPhase }).where(eq(proposal.id, p.id));

	// Events after the successful DB write.
	if (newPhase === 'deliberation') {
		emit('deliberation.started', { proposalId: p.id, communityId: p.communityId });
	}
	if (newPhase === 'voting') {
		emit('proposal.started', { proposalId: p.id, communityId: p.communityId });
	}
	// Voting ended — fire once, when crossing from a pre-/in-voting phase into a post-voting one.
	const wasOpen = prev === 'draft' || prev === 'deliberation' || prev === 'voting';
	const nowClosed = newPhase === 'objection-window' || newPhase === 'finalized';
	if (wasOpen && nowClosed) {
		const results = await aggregateResults(p.id, db);
		emit('proposal.closed', { proposalId: p.id, communityId: p.communityId, results });
	}
	if (newPhase === 'finalized') {
		emit('proposal.finalized', {
			proposalId: p.id,
			communityId: p.communityId,
			outcome: p.outcome ?? 'recorded'
		});
	}

	return { ...p, phase: newPhase };
}
