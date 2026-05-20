import { describe, it, expect, beforeEach, vi } from 'vitest';

// Prevent the real db/index.ts from loading (it requires DATABASE_URL and opens local.db)
vi.mock('$lib/server/db', () => ({ db: null }));

import { createTestDb, seedUser, type TestDb } from './test-helpers';
import {
	createCommunity,
	updateCommunity,
	getCommunityBySlug,
	getUserCommunities,
	getPublicCommunities
} from './community-service';
import { ServiceError, ErrorCode } from './errors';

let db: TestDb;
let adminUser: Awaited<ReturnType<typeof seedUser>>;

beforeEach(async () => {
	db = createTestDb();
	adminUser = await seedUser(db);
});

describe('createCommunity', () => {
	it('creates a community and adds creator as admin', async () => {
		const result = await createCommunity(
			adminUser.id,
			{ name: 'Eco Village', slug: 'eco-village', description: 'A test community' },
			db
		);

		expect(result.name).toBe('Eco Village');
		expect(result.slug).toBe('eco-village');
		expect(result.description).toBe('A test community');
		expect(result.visibility).toBe('public');
		expect(result.verified).toBe(false);
		expect(result.createdBy).toBe(adminUser.id);
	});

	it('rejects duplicate slugs', async () => {
		await createCommunity(adminUser.id, { name: 'First', slug: 'my-slug' }, db);

		await expect(
			createCommunity(adminUser.id, { name: 'Second', slug: 'my-slug' }, db)
		).rejects.toThrow(ServiceError);

		try {
			await createCommunity(adminUser.id, { name: 'Second', slug: 'my-slug' }, db);
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.INVALID_REQUEST);
		}
	});

	it('rejects invalid slug format', async () => {
		await expect(
			createCommunity(adminUser.id, { name: 'Test', slug: '-bad-slug-' }, db)
		).rejects.toThrow(ServiceError);
	});

	it('rejects empty name', async () => {
		await expect(
			createCommunity(adminUser.id, { name: '', slug: 'valid-slug' }, db)
		).rejects.toThrow(ServiceError);
	});

	it('rejects slug that is too short', async () => {
		await expect(createCommunity(adminUser.id, { name: 'Test', slug: 'a' }, db)).rejects.toThrow(
			ServiceError
		);
	});
});

describe('updateCommunity', () => {
	it('admin can update community name and description', async () => {
		const comm = await createCommunity(adminUser.id, { name: 'Original', slug: 'original' }, db);

		const updated = await updateCommunity(
			adminUser.id,
			comm.id,
			{ name: 'Updated', description: 'New desc' },
			db
		);

		expect(updated.name).toBe('Updated');
		expect(updated.description).toBe('New desc');
	});

	it('non-admin cannot update community', async () => {
		const comm = await createCommunity(adminUser.id, { name: 'Test', slug: 'test' }, db);

		const otherUser = await seedUser(db);

		await expect(updateCommunity(otherUser.id, comm.id, { name: 'Hacked' }, db)).rejects.toThrow(
			ServiceError
		);

		try {
			await updateCommunity(otherUser.id, comm.id, { name: 'Hacked' }, db);
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.FORBIDDEN);
		}
	});

	it('rejects empty update', async () => {
		const comm = await createCommunity(adminUser.id, { name: 'Test', slug: 'test' }, db);

		await expect(updateCommunity(adminUser.id, comm.id, {}, db)).rejects.toThrow(ServiceError);
	});
});

describe('getCommunityBySlug', () => {
	it('returns a public community without auth', async () => {
		await createCommunity(
			adminUser.id,
			{ name: 'Public Comm', slug: 'public-comm', visibility: 'public' },
			db
		);

		const result = await getCommunityBySlug('public-comm', undefined, db);
		expect(result.name).toBe('Public Comm');
	});

	it('returns community-visible community for a member', async () => {
		const comm = await createCommunity(
			adminUser.id,
			{ name: 'Private', slug: 'private', visibility: 'community' },
			db
		);

		const result = await getCommunityBySlug('private', adminUser.id, db);
		expect(result.id).toBe(comm.id);
	});

	it('rejects unauthenticated access to community-visible community', async () => {
		await createCommunity(
			adminUser.id,
			{ name: 'Private', slug: 'private', visibility: 'community' },
			db
		);

		await expect(getCommunityBySlug('private', undefined, db)).rejects.toThrow(ServiceError);
	});

	it('rejects non-member access to community-visible community', async () => {
		await createCommunity(
			adminUser.id,
			{ name: 'Private', slug: 'private', visibility: 'community' },
			db
		);

		const otherUser = await seedUser(db);

		try {
			await getCommunityBySlug('private', otherUser.id, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.FORBIDDEN);
		}
	});

	it('throws NOT_FOUND for non-existent slug', async () => {
		try {
			await getCommunityBySlug('does-not-exist', undefined, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.NOT_FOUND);
		}
	});
});

describe('getUserCommunities', () => {
	it('returns communities the user is a member of', async () => {
		await createCommunity(adminUser.id, { name: 'First', slug: 'first' }, db);
		await createCommunity(adminUser.id, { name: 'Second', slug: 'second' }, db);

		const result = await getUserCommunities(adminUser.id, {}, db);
		expect(result.items).toHaveLength(2);
	});

	it('does not return communities the user is not a member of', async () => {
		await createCommunity(adminUser.id, { name: 'My Comm', slug: 'my-comm' }, db);

		const otherUser = await seedUser(db);
		const result = await getUserCommunities(otherUser.id, {}, db);
		expect(result.items).toHaveLength(0);
	});
});

describe('getPublicCommunities', () => {
	it('returns only public communities', async () => {
		await createCommunity(
			adminUser.id,
			{ name: 'Public', slug: 'public', visibility: 'public' },
			db
		);
		await createCommunity(
			adminUser.id,
			{ name: 'Private', slug: 'private', visibility: 'community' },
			db
		);

		const result = await getPublicCommunities('newest', 10, db);
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('Public');
	});

	it('includes member and vote counts', async () => {
		await createCommunity(
			adminUser.id,
			{ name: 'Active', slug: 'active', visibility: 'public' },
			db
		);

		const result = await getPublicCommunities('newest', 10, db);
		expect(result).toHaveLength(1);
		expect(result[0].memberCount).toBe(1); // creator is admin member
		expect(result[0].voteCount).toBe(0);
	});
});
