import { eq, and, desc, lt, or, count, sql } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import { community, communityMember, invite, proposal, user, vote } from '$lib/server/db/schema';
import { ServiceError, ErrorCode } from './errors';
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

export interface CreateInviteInput {
	maxUses?: number;
	expiresAt: Date | string;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Look up a membership record. Returns the record or null.
 */
export async function getMember(
	communityId: string,
	userId: string,
	db: Database = defaultDb
) {
	const [member] = await db
		.select()
		.from(communityMember)
		.where(
			and(eq(communityMember.communityId, communityId), eq(communityMember.userId, userId))
		)
		.limit(1);

	return member ?? null;
}

/**
 * Require that a user is a member of a community. Throws `MEMBERSHIP_REQUIRED` if not.
 */
export async function requireMember(
	communityId: string,
	userId: string,
	db: Database = defaultDb
) {
	const member = await getMember(communityId, userId, db);
	if (!member) {
		throw new ServiceError(ErrorCode.MEMBERSHIP_REQUIRED, 'You must be a member of this community');
	}
	return member;
}

/**
 * Require that a user is an admin of a community. Throws `FORBIDDEN` if not.
 */
export async function requireAdmin(
	communityId: string,
	userId: string,
	db: Database = defaultDb
) {
	const member = await getMember(communityId, userId, db);
	if (!member || member.role !== 'admin') {
		throw new ServiceError(ErrorCode.FORBIDDEN, 'Admin role required');
	}
	return member;
}

// ─── Service functions ───────────────────────────────────────────────────────

/**
 * Admin adds a member to a community.
 */
export async function addMember(
	adminUserId: string,
	communityId: string,
	targetUserId: string,
	role: 'admin' | 'member' = 'member',
	db: Database = defaultDb
) {
	await requireAdmin(communityId, adminUserId, db);

	// Verify target user exists
	const [targetUser] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.id, targetUserId))
		.limit(1);

	if (!targetUser) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'User not found');
	}

	// Check if already a member
	const existing = await getMember(communityId, targetUserId, db);
	if (existing) {
		throw new ServiceError(ErrorCode.ALREADY_MEMBER, 'User is already a member of this community');
	}

	// Check unverified community member limit
	await checkMemberLimit(communityId, db);

	const [created] = await db
		.insert(communityMember)
		.values({
			communityId,
			userId: targetUserId,
			role
		})
		.returning();

	emit('member.joined', { communityId, userId: targetUserId });

	return created;
}

/**
 * Admin removes a member from a community. Cannot remove self.
 */
export async function removeMember(
	adminUserId: string,
	communityId: string,
	targetUserId: string,
	db: Database = defaultDb
) {
	await requireAdmin(communityId, adminUserId, db);

	if (adminUserId === targetUserId) {
		throw new ServiceError(
			ErrorCode.FORBIDDEN,
			'Admins cannot remove themselves. Use the leave endpoint instead.'
		);
	}

	const target = await getMember(communityId, targetUserId, db);
	if (!target) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'Member not found');
	}

	await db
		.delete(communityMember)
		.where(
			and(
				eq(communityMember.communityId, communityId),
				eq(communityMember.userId, targetUserId)
			)
		);
}

/**
 * Admin updates a member's role. Cannot change own role.
 * Cannot demote the sole admin.
 */
export async function updateMemberRole(
	adminUserId: string,
	communityId: string,
	targetUserId: string,
	newRole: 'admin' | 'member',
	db: Database = defaultDb
) {
	await requireAdmin(communityId, adminUserId, db);

	if (adminUserId === targetUserId) {
		throw new ServiceError(ErrorCode.FORBIDDEN, 'Cannot change your own role');
	}

	const target = await getMember(communityId, targetUserId, db);
	if (!target) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'Member not found');
	}

	if (target.role === newRole) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, `Member is already a ${newRole}`);
	}

	// If demoting an admin, check they are not the sole admin
	if (target.role === 'admin' && newRole === 'member') {
		const [{ adminCount }] = await db
			.select({ adminCount: count() })
			.from(communityMember)
			.where(
				and(
					eq(communityMember.communityId, communityId),
					eq(communityMember.role, 'admin')
				)
			);

		if (adminCount <= 1) {
			throw new ServiceError(
				ErrorCode.SOLE_ADMIN,
				'Cannot demote the sole admin. Promote another member first.'
			);
		}
	}

	const [updated] = await db
		.update(communityMember)
		.set({ role: newRole })
		.where(
			and(
				eq(communityMember.communityId, communityId),
				eq(communityMember.userId, targetUserId)
			)
		)
		.returning();

	return updated;
}

/**
 * User leaves a community voluntarily.
 * Sole admins cannot leave — they must transfer admin role first.
 */
export async function leaveCommunity(
	userId: string,
	communityId: string,
	db: Database = defaultDb
) {
	const member = await requireMember(communityId, userId, db);

	// If admin, check they are not the sole admin
	if (member.role === 'admin') {
		const [{ adminCount }] = await db
			.select({ adminCount: count() })
			.from(communityMember)
			.where(
				and(
					eq(communityMember.communityId, communityId),
					eq(communityMember.role, 'admin')
				)
			);

		if (adminCount <= 1) {
			throw new ServiceError(
				ErrorCode.SOLE_ADMIN,
				'Cannot leave community as the sole admin. Transfer admin role first.'
			);
		}
	}

	await db
		.delete(communityMember)
		.where(
			and(
				eq(communityMember.communityId, communityId),
				eq(communityMember.userId, userId)
			)
		);
}

/**
 * List members of a community with user profile info and vote count.
 */
export async function listMembers(
	communityId: string,
	pagination: PaginationParams = {},
	db: Database = defaultDb
): Promise<
	PaginatedResult<{
		userId: string;
		name: string;
		displayName: string | null;
		walletAddress: string | null;
		avatarUrl: string | null;
		role: string;
		joinedAt: Date;
		voteCount: number;
	}>
> {
	const limit = clampLimit(pagination.limit);
	const cursor = pagination.cursor ? decodeCursor(pagination.cursor) : null;

	// Subquery: count votes per user within this community
	const voteCountSq = db
		.select({
			userId: vote.userId,
			voteCount: sql<number>`count(*)`.as('member_vote_count')
		})
		.from(vote)
		.innerJoin(proposal, eq(proposal.id, vote.proposalId))
		.where(eq(proposal.communityId, communityId))
		.groupBy(vote.userId)
		.as('mvc');

	const conditions = [eq(communityMember.communityId, communityId)];

	if (cursor) {
		conditions.push(
			or(
				lt(communityMember.joinedAt, new Date(cursor.ts)),
				and(
					eq(communityMember.joinedAt, new Date(cursor.ts)),
					lt(communityMember.id, cursor.id)
				)
			)!
		);
	}

	const rows = await db
		.select({
			memberId: communityMember.id,
			userId: communityMember.userId,
			role: communityMember.role,
			joinedAt: communityMember.joinedAt,
			name: user.name,
			displayName: user.displayName,
			walletAddress: user.walletAddress,
			avatarUrl: user.avatarUrl,
			voteCount: sql<number>`coalesce(${voteCountSq.voteCount}, 0)`
		})
		.from(communityMember)
		.innerJoin(user, eq(communityMember.userId, user.id))
		.leftJoin(voteCountSq, eq(communityMember.userId, voteCountSq.userId))
		.where(and(...conditions))
		.orderBy(desc(communityMember.joinedAt), desc(communityMember.id))
		.limit(limit + 1);

	const hasMore = rows.length > limit;
	const items = hasMore ? rows.slice(0, limit) : rows;

	const nextCursor =
		hasMore && items.length > 0
			? encodeCursor(items[items.length - 1].joinedAt, items[items.length - 1].memberId)
			: null;

	return {
		items: items.map((r) => ({
			userId: r.userId,
			name: r.name,
			displayName: r.displayName,
			walletAddress: r.walletAddress,
			avatarUrl: r.avatarUrl,
			role: r.role,
			joinedAt: r.joinedAt,
			voteCount: r.voteCount
		})),
		nextCursor
	};
}

// ─── Invite lookup ───────────────────────────────────────────────────────────

/**
 * Look up an invite by its token, including community info.
 * Used by the join page to display community details before redemption.
 */
export async function getInviteByToken(token: string, db: Database = defaultDb) {
	const [found] = await db
		.select({
			invite: invite,
			communityName: community.name,
			communitySlug: community.slug,
			communityDescription: community.description
		})
		.from(invite)
		.innerJoin(community, eq(invite.communityId, community.id))
		.where(eq(invite.token, token))
		.limit(1);

	if (!found) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'Invite not found');
	}

	const inv = found.invite;
	const expired = inv.expiresAt.getTime() <= Date.now();
	const exhausted = inv.maxUses !== null && inv.uses >= inv.maxUses;

	return {
		invite: inv,
		community: {
			name: found.communityName,
			slug: found.communitySlug,
			description: found.communityDescription
		},
		expired,
		exhausted
	};
}

// ─── Invites ─────────────────────────────────────────────────────────────────

/**
 * Admin creates an invite link for a community.
 */
export async function createInvite(
	adminUserId: string,
	communityId: string,
	input: CreateInviteInput,
	db: Database = defaultDb
) {
	await requireAdmin(communityId, adminUserId, db);

	const expiresAt =
		typeof input.expiresAt === 'string' ? new Date(input.expiresAt) : input.expiresAt;

	if (isNaN(expiresAt.getTime())) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Invalid expiration date');
	}
	if (expiresAt.getTime() <= Date.now()) {
		throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Expiration date must be in the future');
	}
	if (input.maxUses !== undefined && input.maxUses !== null) {
		if (!Number.isInteger(input.maxUses) || input.maxUses < 1) {
			throw new ServiceError(ErrorCode.INVALID_REQUEST, 'maxUses must be a positive integer');
		}
	}

	const [created] = await db
		.insert(invite)
		.values({
			communityId,
			createdBy: adminUserId,
			maxUses: input.maxUses ?? null,
			expiresAt
		})
		.returning();

	return created;
}

/**
 * Redeem an invite token to join a community.
 */
export async function redeemInvite(
	userId: string,
	token: string,
	db: Database = defaultDb
) {
	// Find invite
	const [found] = await db
		.select()
		.from(invite)
		.where(eq(invite.token, token))
		.limit(1);

	if (!found) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'Invite not found');
	}

	// Check expiry
	if (found.expiresAt.getTime() <= Date.now()) {
		throw new ServiceError(ErrorCode.INVITE_EXPIRED, 'This invite has expired');
	}

	// Check uses
	if (found.maxUses !== null && found.uses >= found.maxUses) {
		throw new ServiceError(ErrorCode.INVITE_EXHAUSTED, 'This invite has reached its usage limit');
	}

	// Check not already member
	const existing = await getMember(found.communityId, userId, db);
	if (existing) {
		throw new ServiceError(ErrorCode.ALREADY_MEMBER, 'You are already a member of this community');
	}

	// Check unverified community member limit
	await checkMemberLimit(found.communityId, db);

	// Atomic: increment uses + add member
	// Note: better-sqlite3 transactions are synchronous — no async/await inside
	const result = db.transaction((tx) => {
		tx
			.update(invite)
			.set({ uses: sql`${invite.uses} + 1` })
			.where(eq(invite.id, found.id))
			.run();

		const newMember = tx
			.insert(communityMember)
			.values({
				communityId: found.communityId,
				userId,
				role: 'member'
			})
			.returning()
			.get();

		return newMember;
	});

	emit('member.joined', { communityId: found.communityId, userId });

	return result;
}

// ─── Private helpers ─────────────────────────────────────────────────────────

/**
 * Check that an unverified community has not reached its member limit (10).
 * Verified communities have no limit.
 */
async function checkMemberLimit(communityId: string, db: Database = defaultDb) {
	const [comm] = await db
		.select({ verified: community.verified })
		.from(community)
		.where(eq(community.id, communityId))
		.limit(1);

	if (!comm) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'Community not found');
	}

	if (!comm.verified) {
		const [{ memberCount }] = await db
			.select({ memberCount: count() })
			.from(communityMember)
			.where(eq(communityMember.communityId, communityId));

		if (memberCount >= 10) {
			throw new ServiceError(
				ErrorCode.COMMUNITY_LIMIT_REACHED,
				'Unverified communities are limited to 10 members'
			);
		}
	}
}
