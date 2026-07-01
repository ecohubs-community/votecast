import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedUser, seedCommunity, seedMember, type TestDb } from './test-helpers';
import { createProposalType, listTypeVersions } from './proposal-type-admin-service';
import { createProposal, updateProposal } from './proposal-service';
import { castMultiQuestionVote, getProposalVoters } from './vote-service';
import { tallyProposal, aggregateResults } from './proposal-results';
import { addSubquestion } from './subquestion-service';
import { loadQuestions } from './multi-question';

let db: TestDb;
let adminId: string;
let communityId: string;

beforeEach(async () => {
	db = createTestDb();
	adminId = (await seedUser(db)).id;
	communityId = (await seedCommunity(db, adminId)).id; // creator is admin + member
});

const mqMethod = { ballotModuleId: 'multi-question', decisionRuleId: 'multi-question' as const };

/** Create a multi-question type and return its current version id. */
async function mqTypeVersion(
	defaults: Parameters<typeof createProposalType>[2]['defaults'] = {},
	deliberationDays = 0
) {
	const type = await createProposalType(
		adminId,
		communityId,
		{ name: 'Common Ground', method: { ...mqMethod, deliberationDays }, defaults },
		db
	);
	const [v1] = await listTypeVersions(type.id, db);
	return v1.id;
}

const future = (ms: number) => new Date(Date.now() + ms);

describe('multi-question persistence (5b.1)', () => {
	it('stores each question with Agree/Disagree/Abstain position-choices', async () => {
		const typeVersionId = await mqTypeVersion();
		const p = await createProposal(
			adminId,
			{
				communityId,
				title: 'Community priorities',
				body: 'Body text here',
				choices: [],
				questions: ['Should we adopt X?', 'Should we adopt Y?'],
				startTime: future(60_000),
				endTime: future(3_600_000),
				typeVersionId
			},
			db
		);

		const questions = await loadQuestions(p.id, db);
		expect(questions.map((q) => q.prompt)).toEqual(['Should we adopt X?', 'Should we adopt Y?']);
		expect(questions[0].choices.map((c) => c.label)).toEqual(['Agree', 'Disagree', 'Abstain']);
	});

	it('rejects a multi-question proposal with no questions', async () => {
		const typeVersionId = await mqTypeVersion();
		await expect(
			createProposal(
				adminId,
				{
					communityId,
					title: 'Empty',
					body: 'Body text here',
					choices: [],
					questions: [],
					startTime: future(60_000),
					endTime: future(3_600_000),
					typeVersionId
				},
				db
			)
		).rejects.toThrow(/at least one question/i);
	});
});

describe('multi-question tally end-to-end (5b.1)', () => {
	it('resolves each sub-question independently from per-question votes', async () => {
		const typeVersionId = await mqTypeVersion();
		const p = await createProposal(
			adminId,
			{
				communityId,
				title: 'Two questions',
				body: 'Body text here',
				choices: [],
				questions: ['Q1', 'Q2'],
				startTime: new Date(Date.now() - 1000), // already open
				endTime: future(3_600_000),
				typeVersionId
			},
			db
		);
		const [q1, q2] = await loadQuestions(p.id, db);
		const pick = (q: typeof q1, label: string) => q.choices.find((c) => c.label === label)!.id;

		// Admin: agree Q1, disagree Q2.
		await castMultiQuestionVote(
			adminId,
			{
				proposalId: p.id,
				answers: [
					{ questionId: q1.id, choiceId: pick(q1, 'Agree') },
					{ questionId: q2.id, choiceId: pick(q2, 'Disagree') }
				]
			},
			db
		);
		// Second member: agree both.
		const u2 = await seedUser(db);
		await seedMember(db, communityId, u2.id);
		await castMultiQuestionVote(
			u2.id,
			{
				proposalId: p.id,
				answers: [
					{ questionId: q1.id, choiceId: pick(q1, 'Agree') },
					{ questionId: q2.id, choiceId: pick(q2, 'Agree') }
				]
			},
			db
		);

		const rs = await tallyProposal(p.id, db);
		expect(rs.outcome).toBe('recorded');
		expect(rs.entries.find((e) => e.key === q1.id)?.outcome).toBe('passed'); // 2 agree
		expect(rs.entries.find((e) => e.key === q2.id)?.outcome).toBe('tie'); // 1 agree, 1 disagree
	});

	it('counts ballots (voters), not per-question selections, in aggregateResults (review fix)', async () => {
		const typeVersionId = await mqTypeVersion();
		const p = await createProposal(
			adminId,
			{
				communityId,
				title: 'Count me once',
				body: 'Body text here',
				choices: [],
				questions: ['Q1', 'Q2', 'Q3'],
				startTime: new Date(Date.now() - 1000),
				endTime: future(3_600_000),
				typeVersionId
			},
			db
		);
		const qs = await loadQuestions(p.id, db);
		const answerAll = async (uid: string) =>
			castMultiQuestionVote(
				uid,
				{
					proposalId: p.id,
					answers: qs.map((q) => ({ questionId: q.id, choiceId: q.choices[0].id }))
				},
				db
			);
		await answerAll(adminId);
		const u2 = await seedUser(db);
		await seedMember(db, communityId, u2.id);
		await answerAll(u2.id);

		// 2 voters × 3 questions = 6 selections, but the headline count must be 2 voters.
		expect((await aggregateResults(p.id, db)).totalVotes).toBe(2);

		// Voter list shows each voter once (not once per question), with no flat choice label.
		const voters = await getProposalVoters(p.id, db, 'admin');
		expect(voters).toHaveLength(2);
		expect(voters.every((v) => v.choiceLabel === null)).toBe(true);
	});

	it('rejects editing choices on a multi-question proposal (review fix)', async () => {
		const typeVersionId = await mqTypeVersion();
		const p = await createProposal(
			adminId,
			{
				communityId,
				title: 'No choice edits',
				body: 'Body text here',
				choices: [],
				questions: ['Q1'],
				startTime: future(60_000),
				endTime: future(3_600_000),
				typeVersionId
			},
			db
		);
		await expect(updateProposal(adminId, p.id, { choices: ['Yes', 'No'] }, db)).rejects.toThrow(
			/questions, not choices/i
		);
	});

	it('rejects a selection that does not belong to its question', async () => {
		const typeVersionId = await mqTypeVersion();
		const p = await createProposal(
			adminId,
			{
				communityId,
				title: 'Mismatch',
				body: 'Body text here',
				choices: [],
				questions: ['Q1', 'Q2'],
				startTime: new Date(Date.now() - 1000),
				endTime: future(3_600_000),
				typeVersionId
			},
			db
		);
		const [q1, q2] = await loadQuestions(p.id, db);
		await expect(
			castMultiQuestionVote(
				adminId,
				{
					proposalId: p.id,
					// q2's choice attributed to q1 — invalid pair.
					answers: [{ questionId: q1.id, choiceId: q2.choices[0].id }]
				},
				db
			)
		).rejects.toThrow(/does not belong/i);
	});
});

describe('addSubquestion guards (5b.3)', () => {
	it('refuses to add a question to a non-multi-question proposal', async () => {
		const { proposal: p } = await import('./test-helpers').then((m) =>
			m.seedProposal(db, communityId, adminId, { phase: 'draft' })
		);
		await expect(addSubquestion(adminId, p.id, 'Late question', db)).rejects.toThrow(
			/Common Ground/i
		);
	});

	it('lets any member add during deliberation when the type opens contributions', async () => {
		// 7-day deliberation; voting opens in 1 day → now is within the deliberation window.
		const typeVersionId = await mqTypeVersion(
			{ questionContributors: 'members', questionContributionPhase: 'deliberation' },
			7
		);
		const p = await createProposal(
			adminId,
			{
				communityId,
				title: 'Deliberating',
				body: 'Body text here',
				choices: [],
				questions: ['Seed question'],
				startTime: future(86_400_000),
				endTime: future(2 * 86_400_000),
				typeVersionId
			},
			db
		);
		const member = await seedUser(db);
		await seedMember(db, communityId, member.id);

		await addSubquestion(member.id, p.id, 'A member question', db);
		expect((await loadQuestions(p.id, db)).map((q) => q.prompt)).toContain('A member question');
	});

	it('forbids a non-proposer when contributions are proposer-only', async () => {
		const typeVersionId = await mqTypeVersion(
			{ questionContributors: 'proposer', questionContributionPhase: 'deliberation' },
			7
		);
		const p = await createProposal(
			adminId,
			{
				communityId,
				title: 'Proposer only',
				body: 'Body text here',
				choices: [],
				questions: ['Seed'],
				startTime: future(86_400_000),
				endTime: future(2 * 86_400_000),
				typeVersionId
			},
			db
		);
		const member = await seedUser(db);
		await seedMember(db, communityId, member.id);
		await expect(addSubquestion(member.id, p.id, 'Nope', db)).rejects.toThrow(/proposer/i);
	});

	it('freezes questions once voting has opened', async () => {
		const typeVersionId = await mqTypeVersion(
			{ questionContributors: 'members', questionContributionPhase: 'deliberation' },
			0
		);
		const p = await createProposal(
			adminId,
			{
				communityId,
				title: 'Open already',
				body: 'Body text here',
				choices: [],
				questions: ['Seed'],
				startTime: new Date(Date.now() - 1000), // voting open
				endTime: future(3_600_000),
				typeVersionId
			},
			db
		);
		await expect(addSubquestion(adminId, p.id, 'Too late', db)).rejects.toThrow(/frozen/i);
	});

	it('honors a proposer override of the contribution policy when the type is unlocked', async () => {
		// Type defaults to proposer-at-creation but leaves it unlocked.
		const typeVersionId = await mqTypeVersion({}, 7);
		const p = await createProposal(
			adminId,
			{
				communityId,
				title: 'Overridden',
				body: 'Body text here',
				choices: [],
				questions: ['Seed'],
				// Proposer opens it up to members during deliberation.
				questionContributors: 'members',
				questionContributionPhase: 'deliberation',
				startTime: future(86_400_000),
				endTime: future(2 * 86_400_000),
				typeVersionId
			},
			db
		);
		const member = await seedUser(db);
		await seedMember(db, communityId, member.id);
		await addSubquestion(member.id, p.id, 'Member-added', db);
		expect((await loadQuestions(p.id, db)).map((q) => q.prompt)).toContain('Member-added');
	});

	it('ignores a proposer override when the type locks the contribution policy', async () => {
		const typeVersionId = await mqTypeVersion(
			{
				questionContributors: 'proposer',
				questionContributionPhase: 'creation',
				lockQuestionContribution: true
			},
			7
		);
		const p = await createProposal(
			adminId,
			{
				communityId,
				title: 'Locked policy',
				body: 'Body text here',
				choices: [],
				questions: ['Seed'],
				questionContributors: 'members', // ignored — locked
				questionContributionPhase: 'deliberation', // ignored — locked
				startTime: future(86_400_000),
				endTime: future(2 * 86_400_000),
				typeVersionId
			},
			db
		);
		// Frozen back to the type's creation-only policy → even the proposer can't add later.
		await expect(addSubquestion(adminId, p.id, 'Nope', db)).rejects.toThrow(/created/i);
	});

	it('rejects contributions for a creation-only type', async () => {
		const typeVersionId = await mqTypeVersion(
			{ questionContributors: 'members', questionContributionPhase: 'creation' },
			7
		);
		const p = await createProposal(
			adminId,
			{
				communityId,
				title: 'Creation only',
				body: 'Body text here',
				choices: [],
				questions: ['Seed'],
				startTime: future(86_400_000),
				endTime: future(2 * 86_400_000),
				typeVersionId
			},
			db
		);
		await expect(addSubquestion(adminId, p.id, 'Nope', db)).rejects.toThrow(/created/i);
	});
});
