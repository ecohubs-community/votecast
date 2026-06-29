import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedUser, seedCommunity, seedMember, type TestDb } from './test-helpers';
import {
	createProposalType,
	addTypeVersion,
	setTypeRetired,
	listTypeVersions,
	listAllProposalTypes
} from './proposal-type-admin-service';
import { listProposalTypes } from './proposal-type-service';

let db: TestDb;
let adminId: string;
let communityId: string;

beforeEach(async () => {
	db = createTestDb();
	adminId = (await seedUser(db)).id;
	communityId = (await seedCommunity(db, adminId)).id; // creator is admin
});

const method = { ballotModuleId: 'single-choice', decisionRuleId: 'simple-majority' as const };

describe('createProposalType', () => {
	it('an admin creates a type with a v1 version', async () => {
		const type = await createProposalType(
			adminId,
			communityId,
			{ name: 'Budget vote', description: 'For money', method: { ...method, deliberationDays: 2 } },
			db
		);
		const versions = await listTypeVersions(type.id, db);
		expect(versions).toHaveLength(1);
		expect(versions[0].version).toBe(1);
		expect(versions[0].deliberationSeconds).toBe(2 * 86_400);
		expect(await listProposalTypes(communityId, db)).toHaveLength(1);
	});

	it('a non-admin cannot create a type', async () => {
		const member = await seedUser(db);
		await seedMember(db, communityId, member.id, 'member');
		await expect(
			createProposalType(member.id, communityId, { name: 'X', method }, db)
		).rejects.toThrow();
	});

	it('rejects an invalid ballot/rule combination', async () => {
		await expect(
			createProposalType(
				adminId,
				communityId,
				{ name: 'Bad', method: { ballotModuleId: 'single-choice', decisionRuleId: 'consensus' } },
				db
			)
		).rejects.toThrow();
	});
});

describe('addTypeVersion (immutable versioning)', () => {
	it('appends v2 and leaves v1 unchanged', async () => {
		const type = await createProposalType(adminId, communityId, { name: 'T', method }, db);
		const v1 = (await listTypeVersions(type.id, db))[0];

		await addTypeVersion(adminId, type.id, { ...method, decisionRuleId: 'super-majority' }, db);
		const versions = await listTypeVersions(type.id, db);

		expect(versions.map((v) => v.version)).toEqual([2, 1]);
		const v1After = versions.find((v) => v.version === 1)!;
		expect(v1After.methodSnapshotJson).toBe(v1.methodSnapshotJson); // frozen
	});
});

describe('setTypeRetired', () => {
	it('retires a type (excluded from the picker) and restores it', async () => {
		const type = await createProposalType(adminId, communityId, { name: 'T', method }, db);

		await setTypeRetired(adminId, type.id, true, db);
		expect(await listProposalTypes(communityId, db)).toHaveLength(0); // picker hides retired
		expect(await listAllProposalTypes(communityId, db)).toHaveLength(1); // admin view keeps it

		await setTypeRetired(adminId, type.id, false, db);
		expect(await listProposalTypes(communityId, db)).toHaveLength(1);
	});
});
