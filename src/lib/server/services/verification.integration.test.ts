import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedUser, seedCommunity, type TestDb } from './test-helpers';
import { createProposalType, listTypeVersions } from './proposal-type-admin-service';
import { createProposal, getProposal, getProposalOutcome } from './proposal-service';
import { resolveProposalPhase } from './proposal-phase';
import { renderMarkdown } from '$lib/server/markdown';

// Group 7 — end-to-end verification that the authoring change's guarantees hold together.

let db: TestDb;
let adminId: string;
let communityId: string;

beforeEach(async () => {
	db = createTestDb();
	adminId = (await seedUser(db)).id;
	communityId = (await seedCommunity(db, adminId)).id;
});

const method = { ballotModuleId: 'single-choice', decisionRuleId: 'simple-majority' as const };

describe('7.1 — locked voting window + default choices end-to-end', () => {
	it('applies type defaults and enforces locks while body markdown renders', async () => {
		const type = await createProposalType(
			adminId,
			communityId,
			{
				name: 'Locked operational',
				method,
				defaults: {
					defaultChoices: ['For', 'Against', 'Abstain'],
					votingDays: 5,
					lockChoices: true,
					lockVoting: true
				}
			},
			db
		);
		const [v1] = await listTypeVersions(type.id, db);

		const start = new Date(Date.now() + 60_000);
		const created = await createProposal(
			adminId,
			{
				communityId,
				title: 'Adopt the budget',
				body: '# Budget\n\nWe propose **adopting** the [plan](https://example.com).',
				choices: ['Ignored', 'Client', 'Choices'], // locked → ignored
				startTime: start,
				endTime: new Date(Date.now() + 999 * 86_400_000), // locked → recomputed
				typeVersionId: v1.id
			},
			db
		);

		// Locked choices re-asserted from the type.
		const fetched = await getProposal(created.id, adminId, db);
		expect(fetched.choices.map((c) => c.label)).toEqual(['For', 'Against', 'Abstain']);
		// Locked voting window: end = start + 5 days.
		expect(created.endTime.getTime()).toBe(start.getTime() + 5 * 86_400 * 1000);
		// Body renders as sanitized markdown (heading demoted, link hardened).
		const html = renderMarkdown(fetched.body);
		expect(html).toContain('<h2>Budget</h2>');
		expect(html).toContain('<strong>adopting</strong>');
		expect(html).toContain('rel="noopener nofollow ugc"');
	});
});

describe('7.2 — a not-yet-open proposal is phase-aware with no premature outcome', () => {
	it('resolves a draft phase and hides any outcome before voting', async () => {
		const map = (await import('./proposal-type-service')).seedPresetTypesSync(
			db,
			communityId,
			adminId
		);
		const created = await createProposal(
			adminId,
			{
				communityId,
				title: 'Future consensus item',
				body: 'Body text here',
				choices: ['n/a', 'n/a2'],
				startTime: new Date(Date.now() + 4 * 3_600_000), // opens in 4h
				endTime: new Date(Date.now() + 7 * 86_400_000),
				typeVersionId: map['Constitutional']
			},
			db
		);

		// Phase is draft/deliberation — never the legacy "active", and the UI maps it to a real label.
		const phase = await resolveProposalPhase(created, Date.now(), db);
		expect(['draft', 'deliberation']).toContain(phase);

		// No premature outcome — even an admin can't see a tally before voting opens.
		expect((await getProposalOutcome(created.id, adminId, db, 'admin')).revealed).toBe(false);
		expect((await getProposalOutcome(created.id, adminId, db, 'member')).revealed).toBe(false);
	});
});
