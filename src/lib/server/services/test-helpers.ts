/**
 * Shared test utilities for service tests.
 *
 * Creates an in-memory SQLite database with the full schema applied,
 * and provides helpers for seeding test data.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '$lib/server/db/schema';

export type TestDb = ReturnType<typeof createTestDb>;

/**
 * Create a fresh in-memory SQLite database with the full schema.
 * Each test suite gets its own isolated database.
 *
 * Reads ALL migration files from `drizzle/` in sorted order so that
 * new tables (e.g. wallet_address from Step 5) are automatically included.
 */
export function createTestDb() {
	const sqlite = new BetterSqlite3(':memory:');
	sqlite.pragma('foreign_keys = ON');

	// Read and execute all migration SQL files in order
	const migrationDir = resolve('drizzle');
	const sqlFiles = readdirSync(migrationDir)
		.filter((f) => f.endsWith('.sql'))
		.sort();

	for (const file of sqlFiles) {
		const migrationSql = readFileSync(resolve(migrationDir, file), 'utf-8');
		const statements = migrationSql
			.split('--> statement-breakpoint')
			.map((s) => s.trim())
			.filter(Boolean);

		for (const stmt of statements) {
			sqlite.exec(stmt);
		}
	}

	return drizzle(sqlite, { schema });
}

/**
 * Insert a user directly into the `user` table for testing.
 * Returns the created user record.
 */
export async function seedUser(
	db: TestDb,
	overrides: Partial<typeof schema.user.$inferInsert> = {}
) {
	const id = overrides.id ?? crypto.randomUUID();
	const [created] = await db
		.insert(schema.user)
		.values({
			id,
			name: overrides.name ?? `User ${id.slice(0, 6)}`,
			email: overrides.email ?? `${id.slice(0, 8)}@test.local`,
			emailVerified: overrides.emailVerified ?? false,
			updatedAt: new Date(),
			...overrides
		})
		.returning();

	return created;
}

/**
 * Helper to create a community with an admin member.
 * Returns the community record.
 */
export async function seedCommunity(
	db: TestDb,
	adminUserId: string,
	overrides: Partial<typeof schema.community.$inferInsert> = {}
) {
	const id = overrides.id ?? crypto.randomUUID();
	const slug = overrides.slug ?? `test-${id.slice(0, 8)}`;

	const [comm] = await db
		.insert(schema.community)
		.values({
			id,
			name: overrides.name ?? `Community ${slug}`,
			slug,
			description: overrides.description ?? '',
			visibility: overrides.visibility ?? 'public',
			verified: overrides.verified ?? false,
			createdBy: adminUserId,
			...overrides
		})
		.returning();

	// Add creator as admin
	await db.insert(schema.communityMember).values({
		communityId: comm.id,
		userId: adminUserId,
		role: 'admin'
	});

	return comm;
}

/**
 * Helper to add a member to a community.
 */
export async function seedMember(
	db: TestDb,
	communityId: string,
	userId: string,
	role: 'admin' | 'member' = 'member'
) {
	const [member] = await db
		.insert(schema.communityMember)
		.values({ communityId, userId, role })
		.returning();
	return member;
}

/**
 * Helper to create a proposal with choices.
 */
export async function seedProposal(
	db: TestDb,
	communityId: string,
	createdBy: string,
	overrides: Partial<typeof schema.proposal.$inferInsert> & { choices?: string[] } = {}
) {
	const { choices: choiceLabels = ['Yes', 'No'], ...proposalOverrides } = overrides;

	const [prop] = await db
		.insert(schema.proposal)
		.values({
			communityId,
			title: proposalOverrides.title ?? 'Test Proposal',
			body: proposalOverrides.body ?? 'Test body',
			createdBy,
			strategyId: proposalOverrides.strategyId ?? 'onePersonOneVote',
			visibility: proposalOverrides.visibility ?? 'community',
			status: proposalOverrides.status ?? 'draft',
			startTime: proposalOverrides.startTime ?? new Date(Date.now() + 60_000),
			endTime: proposalOverrides.endTime ?? new Date(Date.now() + 3_600_000),
			...proposalOverrides
		})
		.returning();

	const choiceValues = choiceLabels.map((label, idx) => ({
		proposalId: prop.id,
		label,
		position: idx
	}));

	const createdChoices = await db.insert(schema.proposalChoice).values(choiceValues).returning();

	return { proposal: prop, choices: createdChoices };
}
