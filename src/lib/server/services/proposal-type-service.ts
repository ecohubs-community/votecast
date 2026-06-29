import { eq, and, isNull, isNotNull, inArray } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import {
	community,
	proposal,
	proposalType,
	proposalTypeVersion,
	vote,
	voteSelection
} from '$lib/server/db/schema';
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
 * Defensively parse a stored method snapshot. Corrupt JSON or a snapshot missing its required
 * binding ids returns null (caller falls back to the legacy method) rather than crashing a tally.
 */
function parseSnapshot(json: string, source: string): MethodSnapshot | null {
	try {
		const parsed = JSON.parse(json) as Partial<MethodSnapshot>;
		if (typeof parsed?.ballotModuleId === 'string' && typeof parsed?.decisionRuleId === 'string') {
			return parsed as MethodSnapshot;
		}
		console.warn(
			`[voting] method snapshot from ${source} is missing required fields; using legacy`
		);
	} catch (err) {
		console.warn(`[voting] failed to parse method snapshot from ${source}; using legacy:`, err);
	}
	return null;
}

export interface MethodContext {
	snapshot: MethodSnapshot;
	deliberationSeconds: number;
}

/**
 * Resolve a proposal's effective method AND deliberation time in a single read (design D4): an
 * ad-hoc override wins (no deliberation); otherwise the pinned type version; otherwise the legacy
 * onePersonOneVote equivalent. Used by the phase engine and tally so they share one query.
 */
export async function resolveMethodContext(
	prop: { methodOverrideJson: string | null; typeVersionId: string | null },
	db: Database = defaultDb
): Promise<MethodContext> {
	if (prop.methodOverrideJson) {
		return {
			snapshot: parseSnapshot(prop.methodOverrideJson, 'proposal override') ?? LEGACY_SNAPSHOT,
			deliberationSeconds: 0
		};
	}
	if (prop.typeVersionId) {
		const [v] = await db
			.select({
				snap: proposalTypeVersion.methodSnapshotJson,
				seconds: proposalTypeVersion.deliberationSeconds
			})
			.from(proposalTypeVersion)
			.where(eq(proposalTypeVersion.id, prop.typeVersionId))
			.limit(1);
		if (v) {
			return {
				snapshot: parseSnapshot(v.snap, `type version ${prop.typeVersionId}`) ?? LEGACY_SNAPSHOT,
				deliberationSeconds: v.seconds ?? 0
			};
		}
	}
	return { snapshot: LEGACY_SNAPSHOT, deliberationSeconds: 0 };
}

export interface ProposalTypeSummary {
	typeId: string;
	name: string;
	description: string;
	currentVersionId: string;
	deliberationSeconds: number;
	ballotModuleId: string;
	decisionRuleId: string;
}

/**
 * List a community's active (non-retired) proposal types with their current version + a method
 * summary — for the proposer's type picker (task 7.3).
 */
export async function listProposalTypes(
	communityId: string,
	db: Database = defaultDb
): Promise<ProposalTypeSummary[]> {
	const types = await db
		.select()
		.from(proposalType)
		.where(and(eq(proposalType.communityId, communityId), isNull(proposalType.retiredAt)));
	if (types.length === 0) return [];

	const versions = await db
		.select()
		.from(proposalTypeVersion)
		.where(
			inArray(
				proposalTypeVersion.typeId,
				types.map((t) => t.id)
			)
		);

	// Pick the highest-version row per type.
	const latestByType = new Map<string, (typeof versions)[number]>();
	for (const v of versions) {
		const cur = latestByType.get(v.typeId);
		if (!cur || v.version > cur.version) latestByType.set(v.typeId, v);
	}

	const summaries: ProposalTypeSummary[] = [];
	for (const t of types) {
		const v = latestByType.get(t.id);
		if (!v) continue;
		const snap = parseSnapshot(v.methodSnapshotJson, `type version ${v.id}`) ?? LEGACY_SNAPSHOT;
		summaries.push({
			typeId: t.id,
			name: t.name,
			description: t.description,
			currentVersionId: v.id,
			deliberationSeconds: v.deliberationSeconds,
			ballotModuleId: snap.ballotModuleId,
			decisionRuleId: snap.decisionRuleId
		});
	}
	return summaries;
}

/** Verify a type version exists and belongs to the given community. Returns its id or null. */
export async function getTypeVersionForCommunity(
	typeVersionId: string,
	communityId: string,
	db: Database = defaultDb
): Promise<string | null> {
	const [row] = await db
		.select({ id: proposalTypeVersion.id })
		.from(proposalTypeVersion)
		.innerJoin(proposalType, eq(proposalType.id, proposalTypeVersion.typeId))
		.where(
			and(eq(proposalTypeVersion.id, typeVersionId), eq(proposalType.communityId, communityId))
		)
		.limit(1);
	return row?.id ?? null;
}

/** Resolve just the effective method snapshot (override → pinned version → legacy). */
export async function resolveMethodSnapshot(
	prop: { methodOverrideJson: string | null; typeVersionId: string | null },
	db: Database = defaultDb
): Promise<MethodSnapshot> {
	return (await resolveMethodContext(prop, db)).snapshot;
}

/**
 * One-time, idempotent back-fill (tasks 4.4/4.5): seed presets for any community that lacks them,
 * pin every proposal without a type version to that community's "Quick poll" v1, and map the legacy
 * `status` onto `phase` (+ a best-effort `outcome` for already-closed proposals).
 */
export async function backfillVotingMethods(db: Database = defaultDb): Promise<{
	communitiesSeeded: number;
	proposalsPinned: number;
	proposalsSkipped: number;
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
				.where(and(eq(proposalType.communityId, c.id), eq(proposalType.name, PRESET_TYPES[0].name)))
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
	let proposalsSkipped = 0;
	for (const p of unpinned) {
		const versionId = quickPollVersionByCommunity[p.communityId];
		if (!versionId) {
			// No Quick poll version found for this community — surface rather than silently drop.
			console.warn(`[voting] back-fill skipped proposal ${p.id}: no preset type for its community`);
			proposalsSkipped++;
			continue;
		}
		const phase = p.status === 'closed' ? 'finalized' : p.status === 'active' ? 'voting' : 'draft';
		const outcome = p.status === 'closed' ? 'recorded' : null; // historical result kept as recorded
		await db
			.update(proposal)
			.set({ typeVersionId: versionId, phase, ...(outcome ? { outcome } : {}) })
			.where(eq(proposal.id, p.id));
		proposalsPinned++;
	}

	return { communitiesSeeded, proposalsPinned, proposalsSkipped };
}

/**
 * Idempotent back-fill of `vote_selection` rows from legacy `vote.choiceId` (task 4.6 prep), so the
 * voting-library tally over `vote_selection` sees historical single-choice votes.
 */
export async function backfillVoteSelections(
	db: Database = defaultDb
): Promise<{ selectionsCreated: number }> {
	const votes = await db
		.select({ proposalId: vote.proposalId, userId: vote.userId, choiceId: vote.choiceId })
		.from(vote)
		.where(isNotNull(vote.choiceId));

	let selectionsCreated = 0;
	for (const v of votes) {
		if (!v.choiceId) continue;
		const [existing] = await db
			.select({ id: voteSelection.id })
			.from(voteSelection)
			.where(and(eq(voteSelection.proposalId, v.proposalId), eq(voteSelection.userId, v.userId)))
			.limit(1);
		if (existing) continue;
		await db
			.insert(voteSelection)
			.values({ proposalId: v.proposalId, userId: v.userId, choiceId: v.choiceId });
		selectionsCreated++;
	}
	return { selectionsCreated };
}
