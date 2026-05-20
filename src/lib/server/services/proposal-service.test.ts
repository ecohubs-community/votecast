import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: null }));
import {
	createTestDb,
	seedUser,
	seedCommunity,
	seedMember,
	seedProposal,
	type TestDb
} from './test-helpers';
import {
	createProposal,
	updateProposal,
	getProposal,
	listProposals,
	getProposalResults,
	transitionProposalStatus
} from './proposal-service';
import { ServiceError, ErrorCode } from './errors';

let db: TestDb;
let admin: Awaited<ReturnType<typeof seedUser>>;
let member: Awaited<ReturnType<typeof seedUser>>;

beforeEach(async () => {
	db = createTestDb();
	admin = await seedUser(db, { name: 'Admin' });
	member = await seedUser(db, { name: 'Member' });
});

describe('createProposal', () => {
	it('creates a proposal with choices', async () => {
		const comm = await seedCommunity(db, admin.id);
		await seedMember(db, comm.id, member.id);

		const result = await createProposal(
			member.id,
			{
				communityId: comm.id,
				title: 'Install Solar Panels',
				body: 'We should install solar panels on the community center roof.',
				choices: ['Yes', 'No', 'Maybe Later'],
				startTime: new Date(Date.now() + 60_000),
				endTime: new Date(Date.now() + 3_600_000)
			},
			db
		);

		expect(result.title).toBe('Install Solar Panels');
		expect(result.status).toBe('draft');
		expect(result.strategyId).toBe('onePersonOneVote');
	});

	it('rejects proposals with fewer than 2 choices', async () => {
		const comm = await seedCommunity(db, admin.id);

		try {
			await createProposal(
				admin.id,
				{
					communityId: comm.id,
					title: 'Bad Proposal',
					body: 'Only one option',
					choices: ['Yes'],
					startTime: new Date(Date.now() + 60_000),
					endTime: new Date(Date.now() + 3_600_000)
				},
				db
			);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.INVALID_CHOICES);
		}
	});

	it('rejects if start_time >= end_time', async () => {
		const comm = await seedCommunity(db, admin.id);

		try {
			await createProposal(
				admin.id,
				{
					communityId: comm.id,
					title: 'Bad Timing',
					body: 'Bad timing proposal',
					choices: ['Yes', 'No'],
					startTime: new Date(Date.now() + 3_600_000),
					endTime: new Date(Date.now() + 60_000)
				},
				db
			);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.INVALID_REQUEST);
		}
	});

	it('rejects non-members from creating proposals', async () => {
		const comm = await seedCommunity(db, admin.id);

		try {
			await createProposal(
				member.id, // not a member yet
				{
					communityId: comm.id,
					title: 'Unauthorized',
					body: 'Should fail',
					choices: ['Yes', 'No'],
					startTime: new Date(Date.now() + 60_000),
					endTime: new Date(Date.now() + 3_600_000)
				},
				db
			);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
		}
	});

	it('enforces unverified community proposal limit of 20', async () => {
		const comm = await seedCommunity(db, admin.id, { verified: false });

		// Create 20 proposals directly
		for (let i = 0; i < 20; i++) {
			await seedProposal(db, comm.id, admin.id, {
				title: `Proposal ${i}`,
				startTime: new Date(Date.now() + 60_000),
				endTime: new Date(Date.now() + 3_600_000)
			});
		}

		// 21st should fail
		try {
			await createProposal(
				admin.id,
				{
					communityId: comm.id,
					title: 'Proposal 21',
					body: 'Too many',
					choices: ['Yes', 'No'],
					startTime: new Date(Date.now() + 60_000),
					endTime: new Date(Date.now() + 3_600_000)
				},
				db
			);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.COMMUNITY_LIMIT_REACHED);
		}
	});

	it('verified community has no proposal limit', async () => {
		const comm = await seedCommunity(db, admin.id, { verified: true });

		// Create 20 proposals directly
		for (let i = 0; i < 20; i++) {
			await seedProposal(db, comm.id, admin.id, {
				title: `Proposal ${i}`,
				startTime: new Date(Date.now() + 60_000),
				endTime: new Date(Date.now() + 3_600_000)
			});
		}

		// 21st should work
		const result = await createProposal(
			admin.id,
			{
				communityId: comm.id,
				title: 'Proposal 21',
				body: 'Should work for verified',
				choices: ['Yes', 'No'],
				startTime: new Date(Date.now() + 60_000),
				endTime: new Date(Date.now() + 3_600_000)
			},
			db
		);
		expect(result.title).toBe('Proposal 21');
	});
});

describe('updateProposal', () => {
	it('creator can update draft proposal', async () => {
		const comm = await seedCommunity(db, admin.id);
		await seedMember(db, comm.id, member.id);

		const created = await createProposal(
			member.id,
			{
				communityId: comm.id,
				title: 'Original Title',
				body: 'Original body',
				choices: ['Yes', 'No'],
				startTime: new Date(Date.now() + 60_000),
				endTime: new Date(Date.now() + 3_600_000)
			},
			db
		);

		const updated = await updateProposal(
			member.id,
			created.id,
			{ title: 'Updated Title', body: 'Updated body' },
			db
		);

		expect(updated.title).toBe('Updated Title');
		expect(updated.body).toBe('Updated body');
	});

	it('admin can update another user draft proposal', async () => {
		const comm = await seedCommunity(db, admin.id);
		await seedMember(db, comm.id, member.id);

		const created = await createProposal(
			member.id,
			{
				communityId: comm.id,
				title: 'Member Proposal',
				body: 'Body',
				choices: ['Yes', 'No'],
				startTime: new Date(Date.now() + 60_000),
				endTime: new Date(Date.now() + 3_600_000)
			},
			db
		);

		const updated = await updateProposal(admin.id, created.id, { title: 'Admin Override' }, db);

		expect(updated.title).toBe('Admin Override');
	});

	it('cannot update non-draft proposal', async () => {
		const comm = await seedCommunity(db, admin.id);

		// Create a proposal whose start time has passed (will transition to active)
		const { proposal: prop } = await seedProposal(db, comm.id, admin.id, {
			status: 'active',
			startTime: new Date(Date.now() - 60_000),
			endTime: new Date(Date.now() + 3_600_000)
		});

		try {
			await updateProposal(admin.id, prop.id, { title: 'Updated' }, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.PROPOSAL_NOT_EDITABLE);
		}
	});

	it('replaces choices when provided', async () => {
		const comm = await seedCommunity(db, admin.id);

		const created = await createProposal(
			admin.id,
			{
				communityId: comm.id,
				title: 'Choices Test',
				body: 'Body',
				choices: ['A', 'B'],
				startTime: new Date(Date.now() + 60_000),
				endTime: new Date(Date.now() + 3_600_000)
			},
			db
		);

		await updateProposal(admin.id, created.id, { choices: ['X', 'Y', 'Z'] }, db);

		// Verify by fetching proposal with choices
		const fetched = await getProposal(created.id, admin.id, db);
		expect(fetched.choices).toHaveLength(3);
		expect(fetched.choices.map((c) => c.label)).toEqual(['X', 'Y', 'Z']);
	});
});

describe('transitionProposalStatus', () => {
	it('transitions draft → active when startTime has passed', async () => {
		const comm = await seedCommunity(db, admin.id);

		const { proposal: prop } = await seedProposal(db, comm.id, admin.id, {
			status: 'draft',
			startTime: new Date(Date.now() - 60_000), // in the past
			endTime: new Date(Date.now() + 3_600_000)
		});

		const transitioned = await transitionProposalStatus(prop, db);
		expect(transitioned.status).toBe('active');
	});

	it('transitions active → closed when endTime has passed', async () => {
		const comm = await seedCommunity(db, admin.id);

		const { proposal: prop } = await seedProposal(db, comm.id, admin.id, {
			status: 'active',
			startTime: new Date(Date.now() - 3_600_000),
			endTime: new Date(Date.now() - 60_000) // in the past
		});

		const transitioned = await transitionProposalStatus(prop, db);
		expect(transitioned.status).toBe('closed');
	});

	it('transitions draft → closed when both times have passed', async () => {
		const comm = await seedCommunity(db, admin.id);

		const { proposal: prop } = await seedProposal(db, comm.id, admin.id, {
			status: 'draft',
			startTime: new Date(Date.now() - 3_600_000),
			endTime: new Date(Date.now() - 60_000) // both in the past
		});

		const transitioned = await transitionProposalStatus(prop, db);
		expect(transitioned.status).toBe('closed');
	});

	it('does not change status if times are in the future', async () => {
		const comm = await seedCommunity(db, admin.id);

		const { proposal: prop } = await seedProposal(db, comm.id, admin.id, {
			status: 'draft',
			startTime: new Date(Date.now() + 60_000),
			endTime: new Date(Date.now() + 3_600_000)
		});

		const transitioned = await transitionProposalStatus(prop, db);
		expect(transitioned.status).toBe('draft');
	});
});

describe('getProposal', () => {
	it('returns proposal with choices', async () => {
		const comm = await seedCommunity(db, admin.id);

		const created = await createProposal(
			admin.id,
			{
				communityId: comm.id,
				title: 'With Choices',
				body: 'Body',
				choices: ['Yes', 'No'],
				startTime: new Date(Date.now() + 60_000),
				endTime: new Date(Date.now() + 3_600_000)
			},
			db
		);

		const result = await getProposal(created.id, admin.id, db);
		expect(result.title).toBe('With Choices');
		expect(result.choices).toHaveLength(2);
		expect(result.choices[0].label).toBe('Yes');
		expect(result.choices[1].label).toBe('No');
	});

	it('throws NOT_FOUND for non-existent proposal', async () => {
		try {
			await getProposal('non-existent-id', admin.id, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.NOT_FOUND);
		}
	});
});

describe('listProposals', () => {
	it('lists proposals for a community', async () => {
		const comm = await seedCommunity(db, admin.id);
		await seedProposal(db, comm.id, admin.id, { title: 'First' });
		await seedProposal(db, comm.id, admin.id, { title: 'Second' });

		const result = await listProposals(comm.id, {}, {}, db);
		expect(result.items).toHaveLength(2);
	});

	it('filters by status', async () => {
		const comm = await seedCommunity(db, admin.id);
		await seedProposal(db, comm.id, admin.id, { title: 'Draft', status: 'draft' });
		await seedProposal(db, comm.id, admin.id, {
			title: 'Active',
			status: 'active',
			startTime: new Date(Date.now() - 60_000),
			endTime: new Date(Date.now() + 3_600_000)
		});

		const result = await listProposals(comm.id, { status: 'active' }, {}, db);
		expect(result.items).toHaveLength(1);
		expect(result.items[0].title).toBe('Active');
	});
});

describe('getProposalResults', () => {
	it('returns zero results when no votes cast', async () => {
		const comm = await seedCommunity(db, admin.id);
		const { proposal: prop } = await seedProposal(db, comm.id, admin.id, {
			choices: ['Yes', 'No']
		});

		const results = await getProposalResults(prop.id, admin.id, db);
		expect(results.totalVotes).toBe(0);
		expect(results.results).toHaveLength(2);
		expect(results.results[0].votes).toBe(0);
		expect(results.results[1].votes).toBe(0);
	});
});
