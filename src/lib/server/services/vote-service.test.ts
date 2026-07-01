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
import { castVote, getUserVote } from './vote-service';
import { getProposalResults } from './proposal-service';
import { ServiceError, ErrorCode } from './errors';

let db: TestDb;
let admin: Awaited<ReturnType<typeof seedUser>>;

beforeEach(async () => {
	db = createTestDb();
	admin = await seedUser(db, { name: 'Admin' });
});

describe('castVote', () => {
	it('casts a vote on an active proposal', async () => {
		const comm = await seedCommunity(db, admin.id);
		const voter = await seedUser(db, { name: 'Voter' });
		await seedMember(db, comm.id, voter.id);

		const { proposal: prop, choices } = await seedProposal(db, comm.id, admin.id, {
			phase: 'voting',
			startTime: new Date(Date.now() - 60_000),
			endTime: new Date(Date.now() + 3_600_000),
			choices: ['Yes', 'No']
		});

		const result = await castVote(voter.id, { proposalId: prop.id, choiceId: choices[0].id }, db);

		expect(result.proposalId).toBe(prop.id);
		expect(result.userId).toBe(voter.id);
		expect(result.votingPower).toBe(1);
		// The chosen option is recorded on the selection, retrievable via getUserVote.
		const mine = await getUserVote(voter.id, prop.id, db);
		expect(mine?.choiceId).toBe(choices[0].id);
	});

	it('rejects voting on draft proposal', async () => {
		const comm = await seedCommunity(db, admin.id);

		const { proposal: prop, choices } = await seedProposal(db, comm.id, admin.id, {
			phase: 'draft',
			startTime: new Date(Date.now() + 60_000),
			endTime: new Date(Date.now() + 3_600_000)
		});

		try {
			await castVote(admin.id, { proposalId: prop.id, choiceId: choices[0].id }, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.PROPOSAL_NOT_ACTIVE);
		}
	});

	it('rejects voting on closed proposal', async () => {
		const comm = await seedCommunity(db, admin.id);

		const { proposal: prop, choices } = await seedProposal(db, comm.id, admin.id, {
			phase: 'voting',
			startTime: new Date(Date.now() - 3_600_000),
			endTime: new Date(Date.now() - 60_000) // ended
		});

		try {
			await castVote(admin.id, { proposalId: prop.id, choiceId: choices[0].id }, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.PROPOSAL_NOT_ACTIVE);
		}
	});

	it('rejects non-member from voting', async () => {
		const comm = await seedCommunity(db, admin.id);
		const outsider = await seedUser(db, { name: 'Outsider' });

		const { proposal: prop, choices } = await seedProposal(db, comm.id, admin.id, {
			phase: 'voting',
			startTime: new Date(Date.now() - 60_000),
			endTime: new Date(Date.now() + 3_600_000)
		});

		try {
			await castVote(outsider.id, { proposalId: prop.id, choiceId: choices[0].id }, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.MEMBERSHIP_REQUIRED);
		}
	});

	it('rejects invalid choice for this proposal', async () => {
		const comm = await seedCommunity(db, admin.id);

		await seedProposal(db, comm.id, admin.id, {
			phase: 'voting',
			startTime: new Date(Date.now() - 60_000),
			endTime: new Date(Date.now() + 3_600_000)
		});

		// Create another proposal with different choices
		const { proposal: prop2 } = await seedProposal(db, comm.id, admin.id, {
			title: 'Other Proposal',
			phase: 'voting',
			startTime: new Date(Date.now() - 60_000),
			endTime: new Date(Date.now() + 3_600_000)
		});

		// Try voting on prop2 with a choice from a different proposal
		const { choices: otherChoices } = await seedProposal(db, comm.id, admin.id, {
			title: 'Third Proposal',
			phase: 'voting',
			startTime: new Date(Date.now() - 60_000),
			endTime: new Date(Date.now() + 3_600_000)
		});

		try {
			await castVote(admin.id, { proposalId: prop2.id, choiceId: otherChoices[0].id }, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.INVALID_REQUEST);
		}
	});

	it('allows re-voting by default — the later ballot replaces the earlier one', async () => {
		const comm = await seedCommunity(db, admin.id);
		const { proposal: prop, choices } = await seedProposal(db, comm.id, admin.id, {
			phase: 'voting',
			startTime: new Date(Date.now() - 60_000),
			endTime: new Date(Date.now() + 3_600_000)
		});

		await castVote(admin.id, { proposalId: prop.id, choiceId: choices[0].id }, db);
		await castVote(admin.id, { proposalId: prop.id, choiceId: choices[1].id }, db);

		// The recorded choice is the latest, and the tally counts one ballot, not two.
		expect((await getUserVote(admin.id, prop.id, db))?.choiceId).toBe(choices[1].id);
		expect((await getProposalResults(prop.id, admin.id, db)).totalVotes).toBe(1);
	});

	it('rejects re-voting when the method disables mutability', async () => {
		const comm = await seedCommunity(db, admin.id);
		const { proposal: prop, choices } = await seedProposal(db, comm.id, admin.id, {
			phase: 'voting',
			startTime: new Date(Date.now() - 60_000),
			endTime: new Date(Date.now() + 3_600_000),
			methodOverrideJson: JSON.stringify({
				ballotModuleId: 'single-choice',
				decisionRuleId: 'simple-majority',
				config: { voteMutability: false }
			})
		});

		await castVote(admin.id, { proposalId: prop.id, choiceId: choices[0].id }, db);
		try {
			await castVote(admin.id, { proposalId: prop.id, choiceId: choices[1].id }, db);
			expect.unreachable('Should have thrown');
		} catch (e) {
			expect((e as ServiceError).code).toBe(ErrorCode.ALREADY_VOTED);
		}
	});
});

describe('vote counting accuracy', () => {
	it('correctly aggregates votes across multiple users', async () => {
		const comm = await seedCommunity(db, admin.id);

		// Create voters
		const voter1 = await seedUser(db, { name: 'Voter 1' });
		const voter2 = await seedUser(db, { name: 'Voter 2' });
		const voter3 = await seedUser(db, { name: 'Voter 3' });
		await seedMember(db, comm.id, voter1.id);
		await seedMember(db, comm.id, voter2.id);
		await seedMember(db, comm.id, voter3.id);

		const { proposal: prop, choices } = await seedProposal(db, comm.id, admin.id, {
			phase: 'voting',
			startTime: new Date(Date.now() - 60_000),
			endTime: new Date(Date.now() + 3_600_000),
			choices: ['Yes', 'No', 'Abstain']
		});

		// Admin votes Yes, voter1 votes Yes, voter2 votes No, voter3 votes Abstain
		await castVote(admin.id, { proposalId: prop.id, choiceId: choices[0].id }, db);
		await castVote(voter1.id, { proposalId: prop.id, choiceId: choices[0].id }, db);
		await castVote(voter2.id, { proposalId: prop.id, choiceId: choices[1].id }, db);
		await castVote(voter3.id, { proposalId: prop.id, choiceId: choices[2].id }, db);

		const results = await getProposalResults(prop.id, admin.id, db);

		expect(results.totalVotes).toBe(4);
		expect(results.results).toHaveLength(3);

		// Find results by label
		const yesResult = results.results.find((r) => r.label === 'Yes')!;
		const noResult = results.results.find((r) => r.label === 'No')!;
		const abstainResult = results.results.find((r) => r.label === 'Abstain')!;

		expect(yesResult.votes).toBe(2);
		expect(yesResult.votingPower).toBe(2);
		expect(noResult.votes).toBe(1);
		expect(noResult.votingPower).toBe(1);
		expect(abstainResult.votes).toBe(1);
		expect(abstainResult.votingPower).toBe(1);
	});

	it('includes choices with zero votes in results', async () => {
		const comm = await seedCommunity(db, admin.id);

		const { proposal: prop, choices } = await seedProposal(db, comm.id, admin.id, {
			phase: 'voting',
			startTime: new Date(Date.now() - 60_000),
			endTime: new Date(Date.now() + 3_600_000),
			choices: ['Yes', 'No']
		});

		// Only vote "Yes"
		await castVote(admin.id, { proposalId: prop.id, choiceId: choices[0].id }, db);

		const results = await getProposalResults(prop.id, admin.id, db);
		expect(results.totalVotes).toBe(1);
		expect(results.results).toHaveLength(2);

		const noResult = results.results.find((r) => r.label === 'No')!;
		expect(noResult.votes).toBe(0);
		expect(noResult.votingPower).toBe(0);
	});
});
