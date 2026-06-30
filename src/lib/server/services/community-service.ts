import { eq, and, desc, lt, or, sql } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import { community, communityMember, proposal, vote, webhook, invite } from '$lib/server/db/schema';
import { ServiceError, ErrorCode } from './errors';
import { seedPresetTypesSync } from './proposal-type-service';
import { emit } from '../events';
import {
	type PaginationParams,
	type PaginatedResult,
	type Database,
	encodeCursor,
	decodeCursor,
	clampLimit
} from './types';

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateCommunityInput {
	name: string;
	slug: string;
	description?: string;
	visibility?: 'public' | 'community';
}

export interface UpdateCommunityInput {
	name?: string;
	description?: string;
	visibility?: 'public' | 'community';
}

// ─── Validation helpers ──────────────────────────────────────────────────────

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function validateName(name: unknown): asserts name is string {
	if (typeof name !== 'string' || name.trim().length === 0) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Name is required');
	}
	if (name.trim().length > 100) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Name must be at most 100 characters');
	}
}

function validateSlug(slug: unknown): asserts slug is string {
	if (typeof slug !== 'string' || slug.length < 2 || slug.length > 60) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Slug must be 2–60 characters');
	}
	if (!SLUG_RE.test(slug)) {
		throw new ServiceError(
			ErrorCode.INVALID_REQUEST,
			'Slug must be lowercase alphanumeric with hyphens, no leading/trailing hyphens'
		);
	}
}

function validateDescription(description: unknown): asserts description is string {
	if (typeof description !== 'string') {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Description must be a string');
	}
	if (description.length > 2000) {
		throw new ServiceError(
			ErrorCode.INVALID_REQUEST,
			'Description must be at most 2000 characters'
		);
	}
}

function validateVisibility(v: unknown): asserts v is 'public' | 'community' {
	if (v !== 'public' && v !== 'community') {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Visibility must be "public" or "community"');
	}
}

// ─── Service functions ───────────────────────────────────────────────────────

/**
 * Create a new community. The creating user is automatically added as admin.
 */
export async function createCommunity(
	userId: string,
	input: CreateCommunityInput,
	db: Database = defaultDb
) {
	const name = input.name?.trim();
	validateName(name);
	validateSlug(input.slug);

	if (input.description !== undefined) {
		validateDescription(input.description);
	}
	if (input.visibility !== undefined) {
		validateVisibility(input.visibility);
	}

	// Check slug uniqueness
	const [existing] = await db
		.select({ id: community.id })
		.from(community)
		.where(eq(community.slug, input.slug))
		.limit(1);

	if (existing) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Slug is already in use');
	}

	// Atomic: create community + add creator as admin
	// Note: better-sqlite3 transactions are synchronous — no async/await inside
	const result = db.transaction((tx) => {
		const created = tx
			.insert(community)
			.values({
				name,
				slug: input.slug,
				description: input.description ?? '',
				visibility: input.visibility ?? 'public',
				createdBy: userId
			})
			.returning()
			.get();

		tx.insert(communityMember)
			.values({
				communityId: created.id,
				userId,
				role: 'admin'
			})
			.run();

		// Seed the preset proposal types (+ v1 versions) so proposing works immediately.
		seedPresetTypesSync(tx, created.id, userId);

		return created;
	});

	emit('community.created', { communityId: result.id, createdBy: userId });

	return result;
}

/**
 * Update community settings. Requires admin role.
 */
export async function updateCommunity(
	userId: string,
	communityId: string,
	input: UpdateCommunityInput,
	db: Database = defaultDb
) {
	// Verify admin
	const [member] = await db
		.select()
		.from(communityMember)
		.where(
			and(
				eq(communityMember.communityId, communityId),
				eq(communityMember.userId, userId),
				eq(communityMember.role, 'admin')
			)
		)
		.limit(1);

	if (!member) {
		throw new ServiceError(ErrorCode.FORBIDDEN, 'Only community admins can update settings');
	}

	// Validate provided fields
	const updates: Record<string, unknown> = {};

	if (input.name !== undefined) {
		const name = input.name.trim();
		validateName(name);
		updates.name = name;
	}
	if (input.description !== undefined) {
		validateDescription(input.description);
		updates.description = input.description;
	}
	if (input.visibility !== undefined) {
		validateVisibility(input.visibility);
		updates.visibility = input.visibility;
	}

	if (Object.keys(updates).length === 0) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'No fields to update');
	}

	const [updated] = await db
		.update(community)
		.set(updates)
		.where(eq(community.id, communityId))
		.returning();

	if (!updated) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'Community not found');
	}

	return updated;
}

/**
 * Delete a community and all related data. Requires admin role.
 * This is a destructive, irreversible operation.
 */
export async function deleteCommunity(
	userId: string,
	communityId: string,
	db: Database = defaultDb
) {
	// Verify admin
	const [member] = await db
		.select()
		.from(communityMember)
		.where(
			and(
				eq(communityMember.communityId, communityId),
				eq(communityMember.userId, userId),
				eq(communityMember.role, 'admin')
			)
		)
		.limit(1);

	if (!member) {
		throw new ServiceError(ErrorCode.FORBIDDEN, 'Only community admins can delete a community');
	}

	// Delete in correct FK order within a synchronous transaction
	db.transaction((tx) => {
		// Get all proposal IDs for this community
		const proposalIds = tx
			.select({ id: proposal.id })
			.from(proposal)
			.where(eq(proposal.communityId, communityId))
			.all()
			.map((p) => p.id);

		// Delete votes and choices for each proposal
		// (proposalChoice and executionHandler cascade from proposal, but votes do not)
		for (const pid of proposalIds) {
			tx.delete(vote).where(eq(vote.proposalId, pid)).run();
		}

		// Delete proposals (cascades to proposalChoice + executionHandler)
		tx.delete(proposal).where(eq(proposal.communityId, communityId)).run();

		// Delete webhooks, invites, members
		tx.delete(webhook).where(eq(webhook.communityId, communityId)).run();
		tx.delete(invite).where(eq(invite.communityId, communityId)).run();
		tx.delete(communityMember).where(eq(communityMember.communityId, communityId)).run();

		// Delete community
		tx.delete(community).where(eq(community.id, communityId)).run();
	});

	emit('community.deleted', { communityId, deletedBy: userId });
}

/**
 * Get a community by its ID.
 * Same visibility rules as getCommunityBySlug.
 */
export async function getCommunityById(
	communityId: string,
	userId?: string,
	db: Database = defaultDb
) {
	const [found] = await db.select().from(community).where(eq(community.id, communityId)).limit(1);

	if (!found) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'Community not found');
	}

	// Check visibility
	if (found.visibility === 'community') {
		if (!userId) {
			throw new ServiceError(ErrorCode.FORBIDDEN, 'Authentication required to view this community');
		}
		const [member] = await db
			.select({ id: communityMember.id })
			.from(communityMember)
			.where(and(eq(communityMember.communityId, found.id), eq(communityMember.userId, userId)))
			.limit(1);

		if (!member) {
			throw new ServiceError(ErrorCode.FORBIDDEN, 'You must be a member to view this community');
		}
	}

	return found;
}

/**
 * Get a community by its slug.
 * Public communities are accessible to anyone.
 * Community-visible communities require membership.
 */
export async function getCommunityBySlug(slug: string, userId?: string, db: Database = defaultDb) {
	const [found] = await db.select().from(community).where(eq(community.slug, slug)).limit(1);

	if (!found) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'Community not found');
	}

	// Check visibility
	if (found.visibility === 'community') {
		if (!userId) {
			throw new ServiceError(ErrorCode.FORBIDDEN, 'Authentication required to view this community');
		}
		const [member] = await db
			.select({ id: communityMember.id })
			.from(communityMember)
			.where(and(eq(communityMember.communityId, found.id), eq(communityMember.userId, userId)))
			.limit(1);

		if (!member) {
			throw new ServiceError(ErrorCode.FORBIDDEN, 'You must be a member to view this community');
		}
	}

	return found;
}

/**
 * List communities the user is a member of, with their role.
 */
export async function getUserCommunities(
	userId: string,
	pagination: PaginationParams = {},
	db: Database = defaultDb
): Promise<
	PaginatedResult<{
		community: typeof community.$inferSelect;
		role: string;
		memberCount: number;
		voteCount: number;
	}>
> {
	const limit = clampLimit(pagination.limit);
	const cursor = pagination.cursor ? decodeCursor(pagination.cursor) : null;

	// Subqueries for aggregate counts (same pattern as getPublicCommunities)
	const memberCountSq = db
		.select({
			communityId: communityMember.communityId,
			memberCount: sql<number>`count(*)`.as('user_mc')
		})
		.from(communityMember)
		.groupBy(communityMember.communityId)
		.as('umc');

	const voteCountSq = db
		.select({
			communityId: proposal.communityId,
			voteCount: sql<number>`count(${vote.id})`.as('user_vc')
		})
		.from(proposal)
		.leftJoin(vote, eq(vote.proposalId, proposal.id))
		.groupBy(proposal.communityId)
		.as('uvc');

	let query = db
		.select({
			community: community,
			role: communityMember.role,
			joinedAt: communityMember.joinedAt,
			memberId: communityMember.id,
			memberCount: sql<number>`coalesce(${memberCountSq.memberCount}, 0)`,
			voteCount: sql<number>`coalesce(${voteCountSq.voteCount}, 0)`
		})
		.from(communityMember)
		.innerJoin(community, eq(communityMember.communityId, community.id))
		.leftJoin(memberCountSq, eq(community.id, memberCountSq.communityId))
		.leftJoin(voteCountSq, eq(community.id, voteCountSq.communityId))
		.where(eq(communityMember.userId, userId))
		.orderBy(desc(communityMember.joinedAt), desc(communityMember.id))
		.limit(limit + 1)
		.$dynamic();

	if (cursor) {
		query = query.where(
			and(
				eq(communityMember.userId, userId),
				or(
					lt(communityMember.joinedAt, new Date(cursor.ts)),
					and(eq(communityMember.joinedAt, new Date(cursor.ts)), lt(communityMember.id, cursor.id))
				)
			)
		);
	}

	const rows = await query;
	const hasMore = rows.length > limit;
	const items = hasMore ? rows.slice(0, limit) : rows;

	const nextCursor =
		hasMore && items.length > 0
			? encodeCursor(items[items.length - 1].joinedAt, items[items.length - 1].memberId)
			: null;

	return {
		items: items.map((r) => ({
			community: r.community,
			role: r.role,
			memberCount: r.memberCount,
			voteCount: r.voteCount
		})),
		nextCursor
	};
}

/**
 * List public communities for the landing page.
 *
 * sort = 'newest'      → order by createdAt descending
 * sort = 'most_active'  → order by total vote count descending
 */
export async function getPublicCommunities(
	sort: 'newest' | 'most_active' = 'newest',
	limit = 6,
	db: Database = defaultDb
) {
	const effectiveLimit = Math.min(Math.max(limit, 1), 50);

	const memberCountSq = db
		.select({
			communityId: communityMember.communityId,
			memberCount: sql<number>`count(*)`.as('member_count')
		})
		.from(communityMember)
		.groupBy(communityMember.communityId)
		.as('mc');

	const voteCountSq = db
		.select({
			communityId: proposal.communityId,
			voteCount: sql<number>`count(${vote.id})`.as('vote_count')
		})
		.from(proposal)
		.leftJoin(vote, eq(vote.proposalId, proposal.id))
		.groupBy(proposal.communityId)
		.as('vc');

	const baseQuery = db
		.select({
			id: community.id,
			name: community.name,
			slug: community.slug,
			description: community.description,
			memberCount: sql<number>`coalesce(${memberCountSq.memberCount}, 0)`,
			voteCount: sql<number>`coalesce(${voteCountSq.voteCount}, 0)`,
			createdAt: community.createdAt
		})
		.from(community)
		.leftJoin(memberCountSq, eq(community.id, memberCountSq.communityId))
		.leftJoin(voteCountSq, eq(community.id, voteCountSq.communityId))
		.where(eq(community.visibility, 'public'))
		.limit(effectiveLimit);

	if (sort === 'most_active') {
		return baseQuery.orderBy(sql`coalesce(${voteCountSq.voteCount}, 0) desc`);
	}

	return baseQuery.orderBy(desc(community.createdAt));
}

/**
 * Public URL entries for the XML sitemap: every public community and every
 * public proposal that lives inside a public community. Returns lightweight
 * rows (slug/id + last-modified timestamp) suitable for `<url>` generation.
 */
export async function getSitemapEntries(db: Database = defaultDb) {
	const [communities, proposals] = await Promise.all([
		db
			.select({ slug: community.slug, updatedAt: community.updatedAt })
			.from(community)
			.where(eq(community.visibility, 'public'))
			.orderBy(desc(community.updatedAt)),
		db
			.select({ id: proposal.id, updatedAt: proposal.updatedAt })
			.from(proposal)
			.innerJoin(community, eq(proposal.communityId, community.id))
			.where(and(eq(proposal.visibility, 'public'), eq(community.visibility, 'public')))
			.orderBy(desc(proposal.updatedAt))
	]);

	return { communities, proposals };
}
