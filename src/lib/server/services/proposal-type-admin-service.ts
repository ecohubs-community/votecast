import { eq, desc, inArray } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import { proposal, proposalType, proposalTypeVersion } from '$lib/server/db/schema';
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

const DEFAULT_VOTING_SECONDS = 259_200; // 3 days

/**
 * Type-level defaults that pre-fill the proposal form, plus per-field locks. A locked field cannot be
 * changed by the proposer — the create service re-asserts it server-side (design D4).
 */
export interface TypeDefaultsInput {
	defaultChoices?: string[] | null;
	votingDays?: number;
	defaultVisibility?: 'public' | 'community';
	lockChoices?: boolean;
	lockDeliberation?: boolean;
	lockVoting?: boolean;
	lockVisibility?: boolean;
	questionContributors?: 'proposer' | 'members';
	questionContributionPhase?: 'creation' | 'deliberation';
	lockQuestionContribution?: boolean;
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

/**
 * Build the full `proposal_type_versions` insert payload from a method + defaults/locks, validating
 * the method binding and the default-choices-vs-multi-question rule. Shared by create + addTypeVersion
 * so the two paths can never drift.
 */
function buildVersionValues(method: TypeMethodInput, defaults: TypeDefaultsInput = {}) {
	const snapshot = buildSnapshot(method);
	assertValidBinding(snapshot);

	const isMultiQuestion = method.ballotModuleId === 'multi-question';
	let defaultChoices = defaults.defaultChoices?.map((c) => c.trim()).filter(Boolean) ?? null;
	if (defaultChoices && defaultChoices.length > 0) {
		if (isMultiQuestion) {
			throw new ServiceError(
				ErrorCode.INVALID_REQUEST,
				'Default choices are not applicable to a multi-question (Common Ground) type'
			);
		}
		if (defaultChoices.length < 2) {
			throw new ServiceError(
				ErrorCode.INVALID_REQUEST,
				'A type needs at least two default choices, or none'
			);
		}
	} else {
		defaultChoices = null;
	}

	const votingSeconds =
		defaults.votingDays != null
			? Math.max(1, Math.round(defaults.votingDays * 86_400))
			: DEFAULT_VOTING_SECONDS;

	return {
		methodSnapshotJson: JSON.stringify(snapshot),
		deliberationSeconds: deliberationSecondsOf(method),
		votingSeconds,
		defaultChoicesJson: defaultChoices ? JSON.stringify(defaultChoices) : null,
		defaultVisibility: defaults.defaultVisibility ?? 'community',
		lockChoices: defaults.lockChoices ?? false,
		lockDeliberation: defaults.lockDeliberation ?? false,
		lockVoting: defaults.lockVoting ?? false,
		lockVisibility: defaults.lockVisibility ?? false,
		questionContributors: defaults.questionContributors ?? 'proposer',
		questionContributionPhase: defaults.questionContributionPhase ?? 'creation',
		lockQuestionContribution: defaults.lockQuestionContribution ?? false
	};
}

export async function createProposalType(
	userId: string,
	communityId: string,
	input: {
		name: string;
		description?: string;
		method: TypeMethodInput;
		defaults?: TypeDefaultsInput;
	},
	db: Database = defaultDb
) {
	await requireAdmin(communityId, userId, db);
	const name = input.name?.trim();
	if (!name) throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Type name is required');

	const versionValues = buildVersionValues(input.method, input.defaults);

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
			.values({ typeId: type.id, version: 1, createdBy: userId, ...versionValues })
			.run();
		return type;
	});
}

/** Editing a type's method appends a new immutable version (the next version number). */
export async function addTypeVersion(
	userId: string,
	typeId: string,
	method: TypeMethodInput,
	defaults: TypeDefaultsInput = {},
	db: Database = defaultDb
) {
	const [type] = await db.select().from(proposalType).where(eq(proposalType.id, typeId)).limit(1);
	if (!type) throw new ServiceError(ErrorCode.NOT_FOUND, 'Proposal type not found');
	await requireAdmin(type.communityId, userId, db);

	const versionValues = buildVersionValues(method, defaults);

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
			createdBy: userId,
			...versionValues
		})
		.returning()
		.get();
}

/**
 * Permanently delete a type. Allowed only when the type is retired AND no proposal references any of
 * its versions — otherwise in-flight or historical proposals would lose their pinned method (task 3.2).
 */
export async function deleteProposalType(
	userId: string,
	typeId: string,
	db: Database = defaultDb
): Promise<void> {
	const [type] = await db.select().from(proposalType).where(eq(proposalType.id, typeId)).limit(1);
	if (!type) throw new ServiceError(ErrorCode.NOT_FOUND, 'Proposal type not found');
	await requireAdmin(type.communityId, userId, db);

	if (!type.retiredAt) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Retire the type before deleting it');
	}

	const versions = await db
		.select({ id: proposalTypeVersion.id })
		.from(proposalTypeVersion)
		.where(eq(proposalTypeVersion.typeId, typeId));
	const versionIds = versions.map((v) => v.id);

	if (versionIds.length > 0) {
		const [used] = await db
			.select({ id: proposal.id })
			.from(proposal)
			.where(inArray(proposal.typeVersionId, versionIds))
			.limit(1);
		if (used) {
			throw new ServiceError(
				ErrorCode.INVALID_REQUEST,
				'Cannot delete a type that still has proposals; it can stay retired instead'
			);
		}
	}

	// Versions cascade via the FK; remove the type (and its now-orphan versions explicitly first).
	await db.delete(proposalTypeVersion).where(eq(proposalTypeVersion.typeId, typeId));
	await db.delete(proposalType).where(eq(proposalType.id, typeId));
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

/** Type ids in a community that have at least one proposal (any version) — drives the delete gate. */
export async function getTypeIdsWithProposals(
	communityId: string,
	db: Database = defaultDb
): Promise<string[]> {
	const rows = await db
		.selectDistinct({ typeId: proposalType.id })
		.from(proposal)
		.innerJoin(proposalTypeVersion, eq(proposalTypeVersion.id, proposal.typeVersionId))
		.innerJoin(proposalType, eq(proposalType.id, proposalTypeVersion.typeId))
		.where(eq(proposalType.communityId, communityId));
	return rows.map((r) => r.typeId);
}
