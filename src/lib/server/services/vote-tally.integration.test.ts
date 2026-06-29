import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
	createTestDb,
	seedUser,
	seedCommunity,
	seedMember,
	seedProposal,
	type TestDb
} from './test-helpers';
import { voteSelection } from '$lib/server/db/schema';
import { castVote } from './vote-service';
import { tallyProposal, aggregateResults } from './proposal-results';

let db: TestDb;
let adminId: string;
let communityId: string;

beforeEach(async () => {
	db = createTestDb();
	const admin = await seedUser(db);
	adminId = admin.id;
	const comm = await seedCommunity(db, adminId); // creator counts as a member
	communityId = comm.id;
});

const openProposal = () =>
	seedProposal(db, communityId, adminId, {
		status: 'active',
		startTime: new Date(Date.now() - 1000),
		endTime: new Date(Date.now() + 3_600_000),
		choices: ['Yes', 'No']
	});

describe('vote/results flip: castVote → vote_selection → tallyProposal', () => {
	it('writes a vote_selection per vote and tallies via the voting library', async () => {
		const { proposal: p, choices } = await openProposal();
		const u1 = await seedUser(db);
		await seedMember(db, communityId, u1.id);
		const u2 = await seedUser(db);
		await seedMember(db, communityId, u2.id);

		await castVote(u1.id, { proposalId: p.id, choiceId: choices[0].id }, db);
		await castVote(u2.id, { proposalId: p.id, choiceId: choices[0].id }, db);

		const sels = await db.select().from(voteSelection).where(eq(voteSelection.proposalId, p.id));
		expect(sels).toHaveLength(2);
		expect(sels.every((s) => s.choiceId === choices[0].id)).toBe(true);

		const rs = await tallyProposal(p.id, db);
		expect(rs.outcome).toBe('passed');
		expect(rs.entries.find((e) => e.key === choices[0].id)?.outcome).toBe('passed');
		expect(rs.participation.ballotsCast).toBe(2);
	});

	it('engine tally agrees with the legacy aggregate for single-choice', async () => {
		const { proposal: p, choices } = await openProposal();
		const u1 = await seedUser(db);
		await seedMember(db, communityId, u1.id);
		await castVote(u1.id, { proposalId: p.id, choiceId: choices[0].id }, db);
		await castVote(adminId, { proposalId: p.id, choiceId: choices[1].id }, db);

		const legacy = await aggregateResults(p.id, db);
		const rs = await tallyProposal(p.id, db);

		// Same total participation, same per-choice weights.
		expect(legacy.totalVotes).toBe(2);
		expect(rs.participation.ballotsCast).toBe(2);
		for (const r of legacy.results) {
			expect(rs.entries.find((e) => e.key === r.choiceId)?.tallyForWeight).toBe(r.votingPower);
		}
		expect(rs.outcome).toBe('tie'); // 1 vs 1
	});

	it('rejects a vote once the voting phase is over', async () => {
		const { proposal: p, choices } = await seedProposal(db, communityId, adminId, {
			status: 'closed',
			startTime: new Date(Date.now() - 7_200_000),
			endTime: new Date(Date.now() - 3_600_000),
			choices: ['Yes', 'No']
		});
		const u1 = await seedUser(db);
		await seedMember(db, communityId, u1.id);
		await expect(
			castVote(u1.id, { proposalId: p.id, choiceId: choices[0].id }, db)
		).rejects.toThrow();
	});
});
