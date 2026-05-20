import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: null }));

import { createTestDb, seedUser, seedCommunity, seedMember, type TestDb } from './test-helpers';
import {
	getMember,
	requireMember,
	requireAdmin,
	addMember,
	removeMember,
	leaveCommunity,
	listMembers,
	createInvite,
	redeemInvite
} from './membership-service';
import { ServiceError, ErrorCode } from './errors';

let db: TestDb;
let admin: Awaited<ReturnType<typeof seedUser>>;
let member: Awaited<ReturnType<typeof seedUser>>;

beforeEach(async () => {
	db = createTestDb();
	admin = await seedUser(db, { name: 'Admin' });
	member = await seedUser(db, { name: 'Member' });
});

describe('getMember / requireMember / requireAdmin', () => {
	it('returns null for non-members', async () => {
		const comm = await seedCommunity(db, admin.id);
		const result = await getMember(comm.id, member.id, db);
		expect(result).toBeNull();
	});

	it('returns member record for members', async () => {
		const comm = await seedCommunity(db, admin.id);
		const result = await getMember(comm.id, admin.id, db);
		expect(result).not.toBeNull();
		expect(result!.role).toBe('admin');
	});

	it('requireMember throws MEMBERSHIP_REQUIRED for non-members', async () => {
		const comm = await seedCommunity(db, admin.id);

		try {
			await requireMember(comm.id, member.id, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
		}
	});

	it('requireAdmin throws FORBIDDEN for regular members', async () => {
		const comm = await seedCommunity(db, admin.id);
		await seedMember(db, comm.id, member.id, 'member');

		try {
			await requireAdmin(comm.id, member.id, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.FORBIDDEN);
		}
	});
});

describe('addMember', () => {
	it('admin adds a member to the community', async () => {
		const comm = await seedCommunity(db, admin.id);

		const result = await addMember(admin.id, comm.id, member.id, 'member', db);
		expect(result.userId).toBe(member.id);
		expect(result.role).toBe('member');
	});

	it('rejects adding an already existing member', async () => {
		const comm = await seedCommunity(db, admin.id);
		await addMember(admin.id, comm.id, member.id, 'member', db);

		try {
			await addMember(admin.id, comm.id, member.id, 'member', db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.ALREADY_MEMBER);
		}
	});

	it('non-admin cannot add members', async () => {
		const comm = await seedCommunity(db, admin.id);
		await seedMember(db, comm.id, member.id, 'member');

		const newUser = await seedUser(db);

		try {
			await addMember(member.id, comm.id, newUser.id, 'member', db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.FORBIDDEN);
		}
	});

	it('enforces unverified community member limit of 10', async () => {
		const comm = await seedCommunity(db, admin.id, { verified: false });

		// Admin is already member #1, add 9 more (2-10)
		for (let i = 2; i <= 10; i++) {
			const u = await seedUser(db);
			await addMember(admin.id, comm.id, u.id, 'member', db);
		}

		// 11th should fail
		const eleventhUser = await seedUser(db);

		try {
			await addMember(admin.id, comm.id, eleventhUser.id, 'member', db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.COMMUNITY_LIMIT_REACHED);
		}
	});

	it('verified community has no member limit', async () => {
		const comm = await seedCommunity(db, admin.id, { verified: true });

		// Add 15 members (admin is #1)
		for (let i = 2; i <= 15; i++) {
			const u = await seedUser(db);
			await addMember(admin.id, comm.id, u.id, 'member', db);
		}

		// This should work even though we have 15 members
		const sixteenthUser = await seedUser(db);
		const result = await addMember(admin.id, comm.id, sixteenthUser.id, 'member', db);
		expect(result.userId).toBe(sixteenthUser.id);
	});
});

describe('removeMember', () => {
	it('admin can remove a member', async () => {
		const comm = await seedCommunity(db, admin.id);
		await seedMember(db, comm.id, member.id, 'member');

		await removeMember(admin.id, comm.id, member.id, db);
		const result = await getMember(comm.id, member.id, db);
		expect(result).toBeNull();
	});

	it('admin cannot remove themselves', async () => {
		const comm = await seedCommunity(db, admin.id);

		try {
			await removeMember(admin.id, comm.id, admin.id, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.FORBIDDEN);
		}
	});
});

describe('leaveCommunity', () => {
	it('member can leave a community', async () => {
		const comm = await seedCommunity(db, admin.id);
		await seedMember(db, comm.id, member.id, 'member');

		await leaveCommunity(member.id, comm.id, db);
		const result = await getMember(comm.id, member.id, db);
		expect(result).toBeNull();
	});

	it('sole admin cannot leave', async () => {
		const comm = await seedCommunity(db, admin.id);

		try {
			await leaveCommunity(admin.id, comm.id, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.SOLE_ADMIN);
		}
	});

	it('admin can leave if another admin exists', async () => {
		const comm = await seedCommunity(db, admin.id);
		const admin2 = await seedUser(db);
		await seedMember(db, comm.id, admin2.id, 'admin');

		await leaveCommunity(admin.id, comm.id, db);
		const result = await getMember(comm.id, admin.id, db);
		expect(result).toBeNull();
	});
});

describe('listMembers', () => {
	it('lists members with user profile info', async () => {
		const comm = await seedCommunity(db, admin.id);
		await seedMember(db, comm.id, member.id, 'member');

		const result = await listMembers(comm.id, {}, db);
		expect(result.items).toHaveLength(2);
		expect(result.items.map((i) => i.userId)).toContain(admin.id);
		expect(result.items.map((i) => i.userId)).toContain(member.id);
	});
});

describe('createInvite', () => {
	it('admin creates an invite with expiration', async () => {
		const comm = await seedCommunity(db, admin.id);

		const result = await createInvite(
			admin.id,
			comm.id,
			{ expiresAt: new Date(Date.now() + 86_400_000) },
			db
		);

		expect(result.token).toBeTruthy();
		expect(result.communityId).toBe(comm.id);
		expect(result.maxUses).toBeNull();
	});

	it('non-admin cannot create invites', async () => {
		const comm = await seedCommunity(db, admin.id);
		await seedMember(db, comm.id, member.id, 'member');

		try {
			await createInvite(member.id, comm.id, { expiresAt: new Date(Date.now() + 86_400_000) }, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.FORBIDDEN);
		}
	});

	it('rejects expired invite creation', async () => {
		const comm = await seedCommunity(db, admin.id);

		try {
			await createInvite(admin.id, comm.id, { expiresAt: new Date(Date.now() - 1000) }, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.INVALID_REQUEST);
		}
	});
});

describe('redeemInvite', () => {
	it('user joins community via valid invite', async () => {
		const comm = await seedCommunity(db, admin.id);
		const inv = await createInvite(
			admin.id,
			comm.id,
			{ expiresAt: new Date(Date.now() + 86_400_000) },
			db
		);

		const result = await redeemInvite(member.id, inv.token, db);
		expect(result.userId).toBe(member.id);
		expect(result.role).toBe('member');
	});

	it('rejects expired invite', async () => {
		const comm = await seedCommunity(db, admin.id);

		// Create invite with past expiry directly in DB
		const { invite: inviteTable } = await import('$lib/server/db/schema');
		const [inv] = await db
			.insert(inviteTable)
			.values({
				communityId: comm.id,
				createdBy: admin.id,
				expiresAt: new Date(Date.now() - 1000)
			})
			.returning();

		try {
			await redeemInvite(member.id, inv.token, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.INVITE_EXPIRED);
		}
	});

	it('rejects exhausted invite', async () => {
		const comm = await seedCommunity(db, admin.id);
		const inv = await createInvite(
			admin.id,
			comm.id,
			{ expiresAt: new Date(Date.now() + 86_400_000), maxUses: 1 },
			db
		);

		// First use
		await redeemInvite(member.id, inv.token, db);

		// Second use should fail
		const anotherUser = await seedUser(db);

		try {
			await redeemInvite(anotherUser.id, inv.token, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.INVITE_EXHAUSTED);
		}
	});

	it('rejects already-member redeeming invite', async () => {
		const comm = await seedCommunity(db, admin.id);
		const inv = await createInvite(
			admin.id,
			comm.id,
			{ expiresAt: new Date(Date.now() + 86_400_000) },
			db
		);

		// Admin is already a member
		try {
			await redeemInvite(admin.id, inv.token, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.ALREADY_MEMBER);
		}
	});

	it('enforces unverified community member limit via invite', async () => {
		const comm = await seedCommunity(db, admin.id, { verified: false });

		// Fill to 10 members
		for (let i = 2; i <= 10; i++) {
			const u = await seedUser(db);
			await seedMember(db, comm.id, u.id, 'member');
		}

		const inv = await createInvite(
			admin.id,
			comm.id,
			{ expiresAt: new Date(Date.now() + 86_400_000) },
			db
		);

		const newUser = await seedUser(db);

		try {
			await redeemInvite(newUser.id, inv.token, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.COMMUNITY_LIMIT_REACHED);
		}
	});
});
