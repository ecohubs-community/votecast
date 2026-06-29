import { eq, and, isNull } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import { community, proposal, proposalType, proposalTypeVersion } from '$lib/server/db/schema';
import { PRESET_TYPES, LEGACY_SNAPSHOT, type MethodSnapshot } from '$lib/server/voting';
import type { Database } from './types';

// better-sqlite3 transaction handle has the same insert API as the db; typed loosely for reuse.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

/**
 * Seed the preset proposal types (+ their v1 versions) for a community. Synchronous so it can run
 * inside the better-sqlite3 transaction in `createCommunity`. Returns a map of preset name → versionId.
 */
export function seedPresetTypesSync(
	tx: Tx,
	communityId: string,
	userId: string
): Record<string, string> {
	const versionIdByName: Record<string, string> = {};
	for (const preset of PRESET_TYPES) {
		const type = tx
			.insert(proposalType)
			.values({
				communityId,
				name: preset.name,
				description: preset.description,
				createdBy: userId
			})
			.returning()
			.get();
		const version = tx
			.insert(proposalTypeVersion)
			.values({
				typeId: type.id,
				version: 1,
				methodSnapshotJson: JSON.stringify(preset.snapshot),
				deliberationSeconds: preset.deliberationSeconds,
				createdBy: userId
			})
			.returning()
			.get();
		versionIdByName[preset.name] = version.id;
	}
	return versionIdByName;
}

/**
 * Resolve a proposal's effective method (design D4): an ad-hoc override snapshot wins; otherwise the
 * pinned type version; otherwise the legacy onePersonOneVote equivalent (pre-back-fill safety).
 */
export async function resolveMethodSnapshot(
	prop: { methodOverrideJson: string | null; typeVersionId: string | null },
	db: Database = defaultDb
): Promise<MethodSnapshot> {
	if (prop.methodOverrideJson) return JSON.parse(prop.methodOverrideJson) as MethodSnapshot;
	if (prop.typeVersionId) {
		const [v] = await db
			.select({ snap: proposalTypeVersion.methodSnapshotJson })
			.from(proposalTypeVersion)
			.where(eq(proposalTypeVersion.id, prop.typeVersionId))
			.limit(1);
		if (v) return JSON.parse(v.snap) as MethodSnapshot;
	}
	return LEGACY_SNAPSHOT;
}

/**
 * One-time, idempotent back-fill (tasks 4.4/4.5): seed presets for any community that lacks them,
 * pin every proposal without a type version to that community's "Quick poll" v1, and map the legacy
 * `status` onto `phase` (+ a best-effort `outcome` for already-closed proposals).
 */
export async function backfillVotingMethods(db: Database = defaultDb): Promise<{
	communitiesSeeded: number;
	proposalsPinned: number;
}> {
	const communities = await db
		.select({ id: community.id, createdBy: community.createdBy })
		.from(community);

	let communitiesSeeded = 0;
	const quickPollVersionByCommunity: Record<string, string> = {};

	for (const c of communities) {
		const existing = await db
			.select({ id: proposalType.id })
			.from(proposalType)
			.where(eq(proposalType.communityId, c.id))
			.limit(1);

		if (existing.length === 0) {
			const seeded = db.transaction((tx: Tx) => seedPresetTypesSync(tx, c.id, c.createdBy));
			quickPollVersionByCommunity[c.id] = seeded[PRESET_TYPES[0].name];
			communitiesSeeded++;
		} else {
			// Already seeded — find the Quick poll v1 to pin against.
			const [qp] = await db
				.select({ versionId: proposalTypeVersion.id })
				.from(proposalType)
				.innerJoin(proposalTypeVersion, eq(proposalTypeVersion.typeId, proposalType.id))
				.where(
					and(eq(proposalType.communityId, c.id), eq(proposalType.name, PRESET_TYPES[0].name))
				)
				.limit(1);
			if (qp) quickPollVersionByCommunity[c.id] = qp.versionId;
		}
	}

	// Pin proposals that have no type version yet, and map status → phase/outcome.
	const unpinned = await db
		.select({ id: proposal.id, communityId: proposal.communityId, status: proposal.status })
		.from(proposal)
		.where(isNull(proposal.typeVersionId));

	let proposalsPinned = 0;
	for (const p of unpinned) {
		const versionId = quickPollVersionByCommunity[p.communityId];
		if (!versionId) continue;
		const phase = p.status === 'closed' ? 'finalized' : p.status === 'active' ? 'voting' : 'draft';
		const outcome = p.status === 'closed' ? 'recorded' : null; // historical result kept as recorded
		await db
			.update(proposal)
			.set({ typeVersionId: versionId, phase, ...(outcome ? { outcome } : {}) })
			.where(eq(proposal.id, p.id));
		proposalsPinned++;
	}

	return { communitiesSeeded, proposalsPinned };
}
