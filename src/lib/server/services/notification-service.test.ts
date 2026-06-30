import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedUser, seedCommunity, seedMember, type TestDb } from './test-helpers';
import {
	createNotification,
	listNotifications,
	markNotificationRead
} from './notification-service';

let db: TestDb;
let adminId: string;
let communityId: string;

beforeEach(async () => {
	db = createTestDb();
	adminId = (await seedUser(db)).id;
	communityId = (await seedCommunity(db, adminId)).id; // admin is a member
});

describe('notification sink', () => {
	it('a community broadcast is visible to members but not to outsiders', async () => {
		const member = await seedUser(db);
		await seedMember(db, communityId, member.id);
		const outsider = await seedUser(db);

		await createNotification(
			{ communityId, event: 'proposal.started', title: 'Voting is open' },
			db
		);

		expect(await listNotifications(member.id, db)).toHaveLength(1);
		expect(await listNotifications(adminId, db)).toHaveLength(1);
		expect(await listNotifications(outsider.id, db)).toHaveLength(0);
	});

	it('a direct notification reaches only its recipient', async () => {
		const other = await seedUser(db);
		await seedMember(db, communityId, other.id);
		await createNotification(
			{ communityId, userId: adminId, event: 'x', title: 'Just for admin' },
			db
		);
		expect(await listNotifications(adminId, db)).toHaveLength(1);
		expect(await listNotifications(other.id, db)).toHaveLength(0);
	});

	it('markNotificationRead only succeeds for the owning user', async () => {
		await createNotification({ communityId, userId: adminId, event: 'x', title: 'mine' }, db);
		const [n] = await listNotifications(adminId, db);
		const stranger = await seedUser(db);
		expect(await markNotificationRead(n.id, stranger.id, db)).toBe(false);
		expect(await markNotificationRead(n.id, adminId, db)).toBe(true);
		const [after] = await listNotifications(adminId, db);
		expect(after.readAt).not.toBeNull();
	});
});
