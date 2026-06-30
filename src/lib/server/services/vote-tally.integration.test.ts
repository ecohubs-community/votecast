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
import { vote, voteSelection } from '$lib/server/db/schema';
import { castVote } from './vote-service';
import { tallyProposal, aggregateResults } from './proposal-results';
import { getProposalOutcome } from './proposal-service';
import { seedPresetTypesSync } from './proposal-type-service';

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
		phase: 'voting',
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

	it('does not reveal an outcome before voting starts (draft), even to an admin', async () => {
		// A consensus proposal with no objections would tally "passed"; it must stay hidden while draft.
		const map = seedPresetTypesSync(db, communityId, adminId); // Constitutional = consent/consensus
		const { proposal: p } = await seedProposal(db, communityId, adminId, {
			phase: 'draft',
			startTime: new Date(Date.now() + 4 * 3_600_000), // opens in 4h
			endTime: new Date(Date.now() + 7 * 86_400_000),
			typeVersionId: map['Constitutional'],
			choices: ['Yes', 'No']
		});
		expect((await getProposalOutcome(p.id, adminId, db, 'admin')).revealed).toBe(false);
		expect((await getProposalOutcome(p.id, adminId, db, 'member')).revealed).toBe(false);
	});

	it('getProposalOutcome reveals a live tally with the resolved outcome', async () => {
		const { proposal: p, choices } = await openProposal(); // legacy method = live reveal
		await castVote(adminId, { proposalId: p.id, choiceId: choices[0].id }, db);
		const out = await getProposalOutcome(p.id, adminId, db, 'member');
		expect(out.revealed).toBe(true);
		expect(out.result?.outcome).toBe('passed');
	});

	it('on-close visibility hides the tally from members until voting closes, but a facilitator sees it', async () => {
		const map = seedPresetTypesSync(db, communityId, adminId); // Operational = on-close
		const { proposal: open } = await seedProposal(db, communityId, adminId, {
			phase: 'voting',
			startTime: new Date(Date.now() - 1000),
			endTime: new Date(Date.now() + 3_600_000),
			typeVersionId: map['Operational'],
			choices: ['Yes', 'No']
		});
		// Member: hidden while open
		expect((await getProposalOutcome(open.id, adminId, db, 'member')).revealed).toBe(false);
		// Facilitator (admin role): always visible
		expect((await getProposalOutcome(open.id, adminId, db, 'admin')).revealed).toBe(true);

		const { proposal: closed } = await seedProposal(db, communityId, adminId, {
			phase: 'finalized',
			startTime: new Date(Date.now() - 7_200_000),
			endTime: new Date(Date.now() - 3_600_000),
			typeVersionId: map['Operational'],
			choices: ['Yes', 'No']
		});
		// Member: visible once voting has closed
		expect((await getProposalOutcome(closed.id, adminId, db, 'member')).revealed).toBe(true);
	});

	it('tallies a consensus (consent) proposal end-to-end over real DB data (task 8.1)', async () => {
		const map = seedPresetTypesSync(db, communityId, adminId); // Constitutional = consent/consensus
		const { proposal: p } = await seedProposal(db, communityId, adminId, {
			phase: 'voting',
			startTime: new Date(Date.now() - 1000),
			endTime: new Date(Date.now() + 3_600_000),
			typeVersionId: map['Constitutional'],
			choices: ['n/a']
		});
		// Two consenting members (consent ballots store a position in vote_selection, not a choiceId).
		const u1 = await seedUser(db);
		const u2 = await seedUser(db);
		for (const u of [u1, u2]) {
			await seedMember(db, communityId, u.id);
			await db.insert(vote).values({ proposalId: p.id, userId: u.id, votingPower: 1 });
			await db
				.insert(voteSelection)
				.values({ proposalId: p.id, userId: u.id, consentPosition: 'consent' });
		}
		expect((await tallyProposal(p.id, db)).outcome).toBe('passed'); // no objection → consensus passes

		// A reasoned objection blocks.
		const u3 = await seedUser(db);
		await seedMember(db, communityId, u3.id);
		await db.insert(vote).values({ proposalId: p.id, userId: u3.id, votingPower: 1 });
		await db.insert(voteSelection).values({
			proposalId: p.id,
			userId: u3.id,
			consentPosition: 'object',
			reason: 'violates the vision'
		});
		expect((await tallyProposal(p.id, db)).outcome).toBe('blocked');
	});

	it('rejects a vote once the voting phase is over', async () => {
		const { proposal: p, choices } = await seedProposal(db, communityId, adminId, {
			phase: 'finalized',
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
