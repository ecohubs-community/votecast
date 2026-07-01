import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedUser, seedCommunity, seedMember, type TestDb } from './test-helpers';
import { createProposalType, listTypeVersions } from './proposal-type-admin-service';
import { createProposal, getProposal } from './proposal-service';
import { castVote } from './vote-service';
import { tallyProposal } from './proposal-results';

let db: TestDb;
let adminId: string;
let communityId: string;

beforeEach(async () => {
	db = createTestDb();
	adminId = (await seedUser(db)).id;
	communityId = (await seedCommunity(db, adminId)).id; // creator is admin + member
});

/** An open approval proposal + a helper to look up its Approve/Reject choice ids. */
async function openApprovalProposal() {
	const type = await createProposalType(
		adminId,
		communityId,
		{
			name: 'Approval',
			method: { ballotModuleId: 'single-choice', decisionRuleId: 'approval-majority' }
		},
		db
	);
	const [v1] = await listTypeVersions(type.id, db);
	const created = await createProposal(
		adminId,
		{
			communityId,
			title: 'Approve the budget?',
			body: 'Body text here',
			choices: ['ignored'], // locked → replaced by the fixed approval ballot
			startTime: new Date(Date.now() - 1000),
			endTime: new Date(Date.now() + 3_600_000),
			typeVersionId: v1.id
		},
		db
	);
	const p = await getProposal(created.id, adminId, db);
	const id = (label: string) => p.choices.find((c) => c.label === label)!.id;
	return { proposalId: p.id, choices: p.choices, approve: id('Approve'), reject: id('Reject') };
}

describe('approval type end-to-end', () => {
	it('forces a fixed, locked Approve/Reject/Abstain ballot', async () => {
		const { choices } = await openApprovalProposal();
		expect(choices.map((c) => c.label)).toEqual(['Approve', 'Reject', 'Abstain']);
	});

	it('passes when approve wins the majority', async () => {
		const { proposalId, approve, reject } = await openApprovalProposal();
		const u2 = await seedUser(db);
		await seedMember(db, communityId, u2.id);
		const u3 = await seedUser(db);
		await seedMember(db, communityId, u3.id);

		await castVote(adminId, { proposalId, choiceId: approve }, db);
		await castVote(u2.id, { proposalId, choiceId: approve }, db);
		await castVote(u3.id, { proposalId, choiceId: reject }, db);

		expect((await tallyProposal(proposalId, db)).outcome).toBe('passed'); // 2 approve vs 1 reject
	});

	it('fails when reject wins — not "passed" just because reject was the top option', async () => {
		const { proposalId, approve, reject } = await openApprovalProposal();
		const u2 = await seedUser(db);
		await seedMember(db, communityId, u2.id);
		const u3 = await seedUser(db);
		await seedMember(db, communityId, u3.id);

		await castVote(adminId, { proposalId, choiceId: reject }, db);
		await castVote(u2.id, { proposalId, choiceId: reject }, db);
		await castVote(u3.id, { proposalId, choiceId: approve }, db);

		const rs = await tallyProposal(proposalId, db);
		expect(rs.outcome).toBe('failed'); // 1 approve vs 2 reject
		expect(rs.entries.find((e) => e.key === approve)?.outcome).toBe('failed');
		expect(rs.entries.find((e) => e.key === reject)?.outcome).toBe('passed'); // reject "won"…
	});
});
