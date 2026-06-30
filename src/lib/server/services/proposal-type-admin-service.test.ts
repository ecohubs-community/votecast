import { describe, it, expect, beforeEach } from 'vitest';
import {
	createTestDb,
	seedUser,
	seedCommunity,
	seedMember,
	seedProposal,
	type TestDb
} from './test-helpers';
import {
	createProposalType,
	addTypeVersion,
	setTypeRetired,
	deleteProposalType,
	listTypeVersions,
	listAllProposalTypes
} from './proposal-type-admin-service';
import { listProposalTypes } from './proposal-type-service';
import { createProposal, getProposal } from './proposal-service';

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

		await addTypeVersion(adminId, type.id, { ...method, decisionRuleId: 'super-majority' }, {}, db);
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

describe('type defaults & locks (task 3.1/3.3)', () => {
	it('persists default choices, voting window, visibility, and locks; surfaces them in the summary', async () => {
		const type = await createProposalType(
			adminId,
			communityId,
			{
				name: 'Templated',
				method,
				defaults: {
					defaultChoices: ['For', 'Against', 'Abstain'],
					votingDays: 5,
					defaultVisibility: 'public',
					lockChoices: true,
					lockVoting: true
				}
			},
			db
		);

		const [v1] = await listTypeVersions(type.id, db);
		expect(JSON.parse(v1.defaultChoicesJson!)).toEqual(['For', 'Against', 'Abstain']);
		expect(v1.votingSeconds).toBe(5 * 86_400);
		expect(v1.defaultVisibility).toBe('public');
		expect(v1.lockChoices).toBe(true);
		expect(v1.lockVoting).toBe(true);

		const summary = (await listProposalTypes(communityId, db)).find((t) => t.typeId === type.id)!;
		expect(summary.defaultChoices).toEqual(['For', 'Against', 'Abstain']);
		expect(summary.lockChoices).toBe(true);
		expect(summary.votingSeconds).toBe(5 * 86_400);
	});

	it('rejects default choices on a multi-question (Common Ground) type', async () => {
		await expect(
			createProposalType(
				adminId,
				communityId,
				{
					name: 'CG',
					method: { ballotModuleId: 'multi-question', decisionRuleId: 'multi-question' },
					defaults: { defaultChoices: ['For', 'Against'] }
				},
				db
			)
		).rejects.toThrow(/multi-question/i);
	});

	it('rejects a single default choice (needs at least two, or none)', async () => {
		await expect(
			createProposalType(
				adminId,
				communityId,
				{ name: 'One', method, defaults: { defaultChoices: ['Only'] } },
				db
			)
		).rejects.toThrow(/at least two/i);
	});
});

describe('deleteProposalType (task 3.2)', () => {
	it('refuses to delete a type that is not retired', async () => {
		const type = await createProposalType(adminId, communityId, { name: 'Live', method }, db);
		await expect(deleteProposalType(adminId, type.id, db)).rejects.toThrow(/retire/i);
	});

	it('refuses to delete a retired type that still has proposals', async () => {
		const type = await createProposalType(adminId, communityId, { name: 'Used', method }, db);
		const [v1] = await listTypeVersions(type.id, db);
		await seedProposal(db, communityId, adminId, { typeVersionId: v1.id });
		await setTypeRetired(adminId, type.id, true, db);

		await expect(deleteProposalType(adminId, type.id, db)).rejects.toThrow(/proposals/i);
		expect(await listAllProposalTypes(communityId, db)).toHaveLength(1); // still there
	});

	it('deletes a retired type with no proposals', async () => {
		const type = await createProposalType(adminId, communityId, { name: 'Unused', method }, db);
		await setTypeRetired(adminId, type.id, true, db);

		await deleteProposalType(adminId, type.id, db);
		expect(await listAllProposalTypes(communityId, db)).toHaveLength(0);
		expect(await listTypeVersions(type.id, db)).toHaveLength(0);
	});

	it('a non-admin cannot delete a type', async () => {
		const type = await createProposalType(adminId, communityId, { name: 'Guard', method }, db);
		await setTypeRetired(adminId, type.id, true, db);
		const outsider = await seedUser(db);
		await seedMember(db, communityId, outsider.id);
		await expect(deleteProposalType(outsider.id, type.id, db)).rejects.toThrow();
	});
});

describe('createProposal honors type defaults + locks (task 3.4)', () => {
	const start = new Date(Date.now() + 60_000);
	const end = new Date(Date.now() + 3_600_000);

	it('enforces locked choices, voting window, and visibility — ignoring client overrides', async () => {
		const type = await createProposalType(
			adminId,
			communityId,
			{
				name: 'Locked',
				method,
				defaults: {
					defaultChoices: ['For', 'Against', 'Abstain'],
					votingDays: 7,
					defaultVisibility: 'public',
					lockChoices: true,
					lockVoting: true,
					lockVisibility: true
				}
			},
			db
		);
		const [v1] = await listTypeVersions(type.id, db);

		const created = await createProposal(
			adminId,
			{
				communityId,
				title: 'Tries to override locks',
				body: 'Body text here',
				choices: ['Sneaky', 'Choices'], // ignored — locked
				visibility: 'community', // ignored — locked
				startTime: start,
				endTime: end, // ignored — locked voting window
				typeVersionId: v1.id
			},
			db
		);

		const fetched = await getProposal(created.id, adminId, db);
		expect(fetched.choices.map((c) => c.label)).toEqual(['For', 'Against', 'Abstain']);
		expect(created.visibility).toBe('public');
		// endTime re-asserted to start + 7 days.
		expect(created.endTime.getTime()).toBe(start.getTime() + 7 * 86_400 * 1000);
	});

	it('applies unlocked defaults as a pre-fill but lets the proposer override them', async () => {
		const type = await createProposalType(
			adminId,
			communityId,
			{
				name: 'Soft defaults',
				method,
				defaults: { defaultChoices: ['Yes', 'No'], defaultVisibility: 'public' }
			},
			db
		);
		const [v1] = await listTypeVersions(type.id, db);

		// Proposer supplies their own choices/visibility — both respected since unlocked.
		const created = await createProposal(
			adminId,
			{
				communityId,
				title: 'Override the soft defaults',
				body: 'Body text here',
				choices: ['Option A', 'Option B', 'Option C'],
				visibility: 'community',
				startTime: start,
				endTime: end,
				typeVersionId: v1.id
			},
			db
		);
		const fetched = await getProposal(created.id, adminId, db);
		expect(fetched.choices.map((c) => c.label)).toEqual(['Option A', 'Option B', 'Option C']);
		expect(created.visibility).toBe('community');
	});
});
