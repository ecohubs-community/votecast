import { eq, and, or, lte } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import { proposal } from '$lib/server/db/schema';
import { emit } from '../events';
import { aggregateResults } from './proposal-results';
import type { Database } from './types';

export type ProposalRecord = typeof proposal.$inferSelect;

/**
 * Lazily transition a proposal's status based on current time.
 * - draft → active when now >= startTime
 * - draft/active → closed when now >= endTime
 *
 * Updates the DB so subsequent reads are fast. Emits lifecycle events on transition.
 *
 * NOTE (legacy path): still drives the `status` column. The phase engine (`proposal-phase.ts`) maps
 * the richer phase/outcome model; this stays until the legacy `status` column is dropped (task 4.6).
 */
export async function transitionProposalStatus(
	p: ProposalRecord,
	db: Database = defaultDb
): Promise<ProposalRecord> {
	const now = Date.now();
	let newStatus = p.status;
	const originalStatus = p.status;

	if (p.status === 'draft' && p.startTime.getTime() <= now) {
		newStatus = 'active';
	}
	if (
		(p.status === 'draft' || p.status === 'active' || newStatus === 'active') &&
		p.endTime.getTime() <= now
	) {
		newStatus = 'closed';
	}

	if (newStatus !== originalStatus) {
		await db.update(proposal).set({ status: newStatus }).where(eq(proposal.id, p.id));

		// Emit events after successful DB write.
		if (newStatus === 'active') {
			emit('proposal.started', { proposalId: p.id, communityId: p.communityId });
		}
		if (newStatus === 'closed') {
			const results = await aggregateResults(p.id, db);
			emit('proposal.closed', { proposalId: p.id, communityId: p.communityId, results });
		}

		return { ...p, status: newStatus };
	}

	return p;
}

/**
 * Batch-transition stale statuses for a community before listing.
 * More efficient than transitioning one at a time.
 */
export async function batchTransitionStatuses(communityId: string, db: Database = defaultDb) {
	const now = new Date();

	// draft → active where startTime has passed (but endTime hasn't)
	await db
		.update(proposal)
		.set({ status: 'active' })
		.where(
			and(
				eq(proposal.communityId, communityId),
				eq(proposal.status, 'draft'),
				lte(proposal.startTime, now)
			)
		);

	// draft/active → closed where endTime has passed
	await db
		.update(proposal)
		.set({ status: 'closed' })
		.where(
			and(
				eq(proposal.communityId, communityId),
				or(eq(proposal.status, 'draft'), eq(proposal.status, 'active')),
				lte(proposal.endTime, now)
			)
		);
}
