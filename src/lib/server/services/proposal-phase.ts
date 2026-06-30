import { db as defaultDb } from '$lib/server/db';
import { resolveMethodContext } from './proposal-type-service';
import { computePhase, type ProposalPhase } from './proposal-phase-compute';
import type { Database } from './types';

// Pure phase math lives in ./proposal-phase-compute (no service imports). Re-exported for convenience.
export {
	computePhase,
	isVotingOpen,
	type ProposalPhase,
	type PhaseTiming
} from './proposal-phase-compute';

/**
 * Resolve a proposal's current phase from its pinned method (deliberation + objection-window timing)
 * and times. Reads the type version's `deliberationSeconds` and the snapshot's objection window.
 */
export async function resolveProposalPhase(
	prop: {
		methodOverrideJson: string | null;
		typeVersionId: string | null;
		startTime: Date;
		endTime: Date;
	},
	now: number,
	db: Database = defaultDb
): Promise<ProposalPhase> {
	const { snapshot, deliberationSeconds } = await resolveMethodContext(prop, db);

	return computePhase(
		{
			startTime: prop.startTime,
			endTime: prop.endTime,
			deliberationSeconds,
			objectionWindowSeconds: snapshot.process.objectionWindowSeconds ?? 0
		},
		now
	);
}
