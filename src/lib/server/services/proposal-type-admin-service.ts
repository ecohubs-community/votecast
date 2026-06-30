import { eq, desc } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import { proposalType, proposalTypeVersion } from '$lib/server/db/schema';
import { ServiceError, ErrorCode } from './errors';
import { requireAdmin } from './membership-service';
import {
	bindingFromSnapshot,
	validateMethodBinding,
	type MethodSnapshot
} from '$lib/server/voting';
import type { Database } from './types';

// Admin-only management of a community's proposal types (task 7.1). Editing a method creates a new
// immutable version (design D4) — existing versions are never mutated.

export interface TypeMethodInput {
	ballotModuleId: string;
	decisionRuleId: string;
	deliberationDays?: number;
	tallyReveal?: 'live' | 'on-close' | 'hidden-forever';
}

/** Curated valid ballot×rule combinations offered in the admin type form (v1). */
export const METHOD_OPTIONS = [
	{ id: 'single-choice|simple-majority', label: 'Single choice — simple majority' },
	{ id: 'single-choice|absolute-majority', label: 'Single choice — absolute majority' },
	{ id: 'single-choice|super-majority', label: 'Single choice — two-thirds majority' },
	{ id: 'consent|consensus', label: 'Consent — consensus' },
	{ id: 'consent|consensus-minus-1', label: 'Consent — consensus minus one' },
	{ id: 'multi-question|multi-question', label: 'Common Ground (multi-question)' }
] as const;

/** Parse a METHOD_OPTIONS id ("ballot|rule") into a method input. */
export function methodFromOptionId(
	optionId: string,
	extra: { deliberationDays?: number; tallyReveal?: TypeMethodInput['tallyReveal'] } = {}
): TypeMethodInput {
	const [ballotModuleId, decisionRuleId] = optionId.split('|');
	return { ballotModuleId, decisionRuleId, ...extra };
}

/** Build a method snapshot from the simplified admin form (all-members + 1p1v defaults). */
function buildSnapshot(input: TypeMethodInput): MethodSnapshot {
	return {
		ballotModuleId: input.ballotModuleId,
		decisionRuleId: input.decisionRuleId,
		eligibility: { kind: 'all-members' },
		weight: { kind: 'one-person-one-vote' },
		visibility: { tallyReveal: input.tallyReveal ?? 'on-close', secretBallot: false },
		process: {},
		config: {}
	};
}

function assertValidBinding(snapshot: MethodSnapshot) {
	const check = validateMethodBinding(bindingFromSnapshot(snapshot));
	if (!check.ok) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, `Invalid method: ${check.errors.join(' ')}`);
	}
}

function deliberationSecondsOf(input: TypeMethodInput): number {
	return Math.max(0, Math.round((input.deliberationDays ?? 0) * 86_400));
}

export async function createProposalType(
	userId: string,
	communityId: string,
	input: { name: string; description?: string; method: TypeMethodInput },
	db: Database = defaultDb
) {
	await requireAdmin(communityId, userId, db);
	const name = input.name?.trim();
	if (!name) throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Type name is required');

	const snapshot = buildSnapshot(input.method);
	assertValidBinding(snapshot);

	return db.transaction((tx) => {
		const type = tx
			.insert(proposalType)
			.values({
				communityId,
				name,
				description: input.description?.trim() ?? '',
				createdBy: userId
			})
			.returning()
			.get();
		tx.insert(proposalTypeVersion)
			.values({
				typeId: type.id,
				version: 1,
				methodSnapshotJson: JSON.stringify(snapshot),
				deliberationSeconds: deliberationSecondsOf(input.method),
				createdBy: userId
			})
			.run();
		return type;
	});
}

/** Editing a type's method appends a new immutable version (the next version number). */
export async function addTypeVersion(
	userId: string,
	typeId: string,
	method: TypeMethodInput,
	db: Database = defaultDb
) {
	const [type] = await db.select().from(proposalType).where(eq(proposalType.id, typeId)).limit(1);
	if (!type) throw new ServiceError(ErrorCode.NOT_FOUND, 'Proposal type not found');
	await requireAdmin(type.communityId, userId, db);

	const snapshot = buildSnapshot(method);
	assertValidBinding(snapshot);

	const [latest] = await db
		.select({ version: proposalTypeVersion.version })
		.from(proposalTypeVersion)
		.where(eq(proposalTypeVersion.typeId, typeId))
		.orderBy(desc(proposalTypeVersion.version))
		.limit(1);

	return db
		.insert(proposalTypeVersion)
		.values({
			typeId,
			version: (latest?.version ?? 0) + 1,
			methodSnapshotJson: JSON.stringify(snapshot),
			deliberationSeconds: deliberationSecondsOf(method),
			createdBy: userId
		})
		.returning()
		.get();
}

/** Retire (or restore) a type. Retired types accept no new proposals; pinned proposals keep running. */
export async function setTypeRetired(
	userId: string,
	typeId: string,
	retired: boolean,
	db: Database = defaultDb
) {
	const [type] = await db.select().from(proposalType).where(eq(proposalType.id, typeId)).limit(1);
	if (!type) throw new ServiceError(ErrorCode.NOT_FOUND, 'Proposal type not found');
	await requireAdmin(type.communityId, userId, db);

	await db
		.update(proposalType)
		.set({ retiredAt: retired ? new Date() : null })
		.where(eq(proposalType.id, typeId));
}

/** All versions of a type, newest first (for the admin version history). */
export async function listTypeVersions(typeId: string, db: Database = defaultDb) {
	return db
		.select()
		.from(proposalTypeVersion)
		.where(eq(proposalTypeVersion.typeId, typeId))
		.orderBy(desc(proposalTypeVersion.version));
}

/** All of a community's types incl. retired ones (admin view). */
export async function listAllProposalTypes(communityId: string, db: Database = defaultDb) {
	return db
		.select()
		.from(proposalType)
		.where(eq(proposalType.communityId, communityId))
		.orderBy(proposalType.createdAt);
}
