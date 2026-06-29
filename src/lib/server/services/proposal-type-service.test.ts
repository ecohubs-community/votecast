import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, seedUser, seedCommunity, seedProposal, type TestDb } from './test-helpers';
import { proposal, proposalType, proposalTypeVersion } from '$lib/server/db/schema';
import {
	seedPresetTypesSync,
	resolveMethodSnapshot,
	backfillVotingMethods,
	listProposalTypes,
	getTypeVersionForCommunity
} from './proposal-type-service';
import { createProposal } from './proposal-service';
import { resolveProposalPhase } from './proposal-phase';
import { PRESET_TYPES, LEGACY_SNAPSHOT } from '$lib/server/voting';

let db: TestDb;
let userId: string;

beforeEach(async () => {
	db = createTestDb();
	const u = await seedUser(db);
	userId = u.id;
});

describe('seedPresetTypesSync', () => {
	it('creates a type + v1 version for every preset', async () => {
		const comm = await seedCommunity(db, userId);
		const map = seedPresetTypesSync(db, comm.id, userId);

		expect(Object.keys(map).sort()).toEqual(PRESET_TYPES.map((p) => p.name).sort());

		const types = await db.select().from(proposalType).where(eq(proposalType.communityId, comm.id));
		expect(types).toHaveLength(PRESET_TYPES.length);

		const versions = await db.select().from(proposalTypeVersion);
		expect(versions).toHaveLength(PRESET_TYPES.length);
		expect(versions.every((v) => v.version === 1)).toBe(true);
		// snapshot round-trips
		const snap = JSON.parse(versions[0].methodSnapshotJson);
		expect(snap.ballotModuleId).toBeDefined();
		expect(snap.decisionRuleId).toBeDefined();
	});
});

describe('resolveMethodSnapshot', () => {
	it('prefers an ad-hoc override snapshot', async () => {
		const override = { ...LEGACY_SNAPSHOT, decisionRuleId: 'super-majority' };
		const snap = await resolveMethodSnapshot(
			{ methodOverrideJson: JSON.stringify(override), typeVersionId: 'whatever' },
			db
		);
		expect(snap.decisionRuleId).toBe('super-majority');
	});

	it('falls back to the pinned type version', async () => {
		const comm = await seedCommunity(db, userId);
		const map = seedPresetTypesSync(db, comm.id, userId);
		const constitutionalVersionId = map['Constitutional'];
		const snap = await resolveMethodSnapshot(
			{ methodOverrideJson: null, typeVersionId: constitutionalVersionId },
			db
		);
		expect(snap.ballotModuleId).toBe('consent');
		expect(snap.decisionRuleId).toBe('consensus');
	});

	it('uses the legacy snapshot when nothing is pinned', async () => {
		const snap = await resolveMethodSnapshot({ methodOverrideJson: null, typeVersionId: null }, db);
		expect(snap).toEqual(LEGACY_SNAPSHOT);
	});

	it('falls back to legacy on corrupt override JSON instead of throwing', async () => {
		const snap = await resolveMethodSnapshot(
			{ methodOverrideJson: '{ not valid json', typeVersionId: null },
			db
		);
		expect(snap).toEqual(LEGACY_SNAPSHOT);
	});

	it('falls back to legacy when the snapshot is missing required fields', async () => {
		const snap = await resolveMethodSnapshot(
			{ methodOverrideJson: JSON.stringify({ visibility: {} }), typeVersionId: null },
			db
		);
		expect(snap).toEqual(LEGACY_SNAPSHOT);
	});
});

describe('backfillVotingMethods', () => {
	it('seeds presets, pins proposals, and maps status → phase', async () => {
		const comm = await seedCommunity(db, userId); // no types seeded
		const { proposal: active } = await seedProposal(db, comm.id, userId, { status: 'active' });
		const { proposal: closed } = await seedProposal(db, comm.id, userId, { status: 'closed' });

		const result = await backfillVotingMethods(db);
		expect(result.communitiesSeeded).toBe(1);
		expect(result.proposalsPinned).toBe(2);

		const [a] = await db.select().from(proposal).where(eq(proposal.id, active.id));
		expect(a.typeVersionId).toBeTruthy();
		expect(a.phase).toBe('voting');

		const [c] = await db.select().from(proposal).where(eq(proposal.id, closed.id));
		expect(c.phase).toBe('finalized');
		expect(c.outcome).toBe('recorded');
	});

	it('is idempotent — a second run seeds and pins nothing new', async () => {
		const comm = await seedCommunity(db, userId);
		await seedProposal(db, comm.id, userId, { status: 'draft' });
		await backfillVotingMethods(db);
		const second = await backfillVotingMethods(db);
		expect(second.communitiesSeeded).toBe(0);
		expect(second.proposalsPinned).toBe(0);
	});
});

describe('type picker support (task 7.3)', () => {
	it('listProposalTypes returns active types with a method summary', async () => {
		const comm = await seedCommunity(db, userId);
		seedPresetTypesSync(db, comm.id, userId);
		const list = await listProposalTypes(comm.id, db);
		expect(list.map((t) => t.name).sort()).toEqual(PRESET_TYPES.map((p) => p.name).sort());
		const constitutional = list.find((t) => t.name === 'Constitutional')!;
		expect(constitutional.ballotModuleId).toBe('consent');
		expect(constitutional.currentVersionId).toBeTruthy();
	});

	it('getTypeVersionForCommunity rejects a version from another community', async () => {
		const a = await seedCommunity(db, userId, { slug: 'a' });
		const b = await seedCommunity(db, userId, { slug: 'b' });
		const mapA = seedPresetTypesSync(db, a.id, userId);
		expect(await getTypeVersionForCommunity(mapA['Quick poll'], a.id, db)).toBeTruthy();
		expect(await getTypeVersionForCommunity(mapA['Quick poll'], b.id, db)).toBeNull();
	});

	it('createProposal pins a chosen type version', async () => {
		const comm = await seedCommunity(db, userId);
		const map = seedPresetTypesSync(db, comm.id, userId);
		const created = await createProposal(
			userId,
			{
				communityId: comm.id,
				title: 'Pinned proposal',
				body: 'Body text',
				choices: ['Yes', 'No'],
				startTime: new Date(Date.now() + 60_000),
				endTime: new Date(Date.now() + 3_600_000),
				typeVersionId: map['Operational']
			},
			db
		);
		const [row] = await db.select().from(proposal).where(eq(proposal.id, created.id));
		expect(row.typeVersionId).toBe(map['Operational']);
	});

	it('createProposal rejects a type version from another community', async () => {
		const a = await seedCommunity(db, userId, { slug: 'aa' });
		const b = await seedCommunity(db, userId, { slug: 'bb' });
		const mapB = seedPresetTypesSync(db, b.id, userId);
		await expect(
			createProposal(
				userId,
				{
					communityId: a.id,
					title: 'X',
					body: 'Body text',
					choices: ['Yes', 'No'],
					startTime: new Date(Date.now() + 60_000),
					endTime: new Date(Date.now() + 3_600_000),
					typeVersionId: mapB['Quick poll']
				},
				db
			)
		).rejects.toThrow();
	});
});

describe('resolveProposalPhase (method timing → phase, DB-backed)', () => {
	const DAY = 86_400_000;
	it('uses the Constitutional method window to resolve the full lifecycle', async () => {
		const comm = await seedCommunity(db, userId);
		const map = seedPresetTypesSync(db, comm.id, userId); // Constitutional: 7d delib, 14d objection window
		// Voting window: day 10 → day 11.
		const { proposal: p } = await seedProposal(db, comm.id, userId, {
			typeVersionId: map['Constitutional'],
			startTime: new Date(10 * DAY),
			endTime: new Date(11 * DAY)
		});
		const at = (n: number) => resolveProposalPhase({ ...p }, n * DAY, db);

		expect(await at(2)).toBe('draft'); // before deliberation (starts day 3)
		expect(await at(5)).toBe('deliberation'); // within [day 3, day 10)
		expect(await at(10.5)).toBe('voting'); // within [day 10, day 11)
		expect(await at(12)).toBe('objection-window'); // within [day 11, day 25)
		expect(await at(30)).toBe('finalized'); // after end + 14d window
	});
});
