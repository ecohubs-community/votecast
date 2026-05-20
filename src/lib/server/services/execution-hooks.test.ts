vi.mock('$lib/server/db', () => ({ db: null }));

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import {
	createTestDb,
	seedUser,
	seedCommunity,
	seedMember,
	seedProposal,
	type TestDb
} from './test-helpers';
import {
	createExecutionHandler,
	getExecutionHandlers,
	deleteExecutionHandler,
	executeProposalHandlers
} from './execution-service';
import { deliverWebhook } from './webhook-delivery';
import { ServiceError, ErrorCode } from './errors';

// ─── Webhook delivery tests ─────────────────────────────────────────────────

describe('deliverWebhook', () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('returns success on 200 response', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));

		const result = await deliverWebhook('https://example.com/hook', 'secret', { test: true });

		expect(result.success).toBe(true);
		expect(result.statusCode).toBe(200);
		expect(result.attempts).toBe(1);
	});

	it('sends correct HMAC signature header', async () => {
		let capturedHeaders: Headers | null = null;
		globalThis.fetch = vi.fn().mockImplementation((url: string, init: RequestInit) => {
			capturedHeaders = new Headers(init.headers);
			return Promise.resolve(new Response('OK', { status: 200 }));
		});

		const payload = { event: 'test', data: {} };
		const secret = 'my-secret';
		await deliverWebhook('https://example.com/hook', secret, payload);

		const body = JSON.stringify(payload);
		const expectedSig = createHmac('sha256', secret).update(body).digest('hex');

		expect(capturedHeaders!.get('X-Webhook-Signature')).toBe(`sha256=${expectedSig}`);
		expect(capturedHeaders!.get('Content-Type')).toBe('application/json');
	});

	it('does not retry on 4xx client errors', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(new Response('Bad Request', { status: 400 }));

		const result = await deliverWebhook('https://example.com/hook', 'secret', {});

		expect(result.success).toBe(false);
		expect(result.statusCode).toBe(400);
		expect(result.attempts).toBe(1);
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it('retries on 500 server errors', async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(new Response('Error', { status: 500 }))
			.mockResolvedValueOnce(new Response('Error', { status: 500 }))
			.mockResolvedValueOnce(new Response('OK', { status: 200 }));

		const result = await deliverWebhook('https://example.com/hook', 'secret', {});

		expect(result.success).toBe(true);
		expect(result.attempts).toBe(3);
		expect(globalThis.fetch).toHaveBeenCalledTimes(3);
	});

	it('returns failure after all retries exhausted', async () => {
		globalThis.fetch = vi.fn().mockResolvedValue(new Response('Error', { status: 500 }));

		const result = await deliverWebhook('https://example.com/hook', 'secret', {});

		expect(result.success).toBe(false);
		expect(result.attempts).toBe(3);
		expect(globalThis.fetch).toHaveBeenCalledTimes(3);
	});

	it('handles network errors with retries', async () => {
		globalThis.fetch = vi
			.fn()
			.mockRejectedValueOnce(new Error('ECONNREFUSED'))
			.mockResolvedValueOnce(new Response('OK', { status: 200 }));

		const result = await deliverWebhook('https://example.com/hook', 'secret', {});

		expect(result.success).toBe(true);
		expect(result.attempts).toBe(2);
	});
});

// ─── Execution service tests ────────────────────────────────────────────────

describe('execution-service', () => {
	let db: TestDb;
	let admin: Awaited<ReturnType<typeof seedUser>>;

	beforeEach(async () => {
		db = createTestDb();
		admin = await seedUser(db, { name: 'Admin' });
	});

	describe('createExecutionHandler', () => {
		it('creates a webhook handler for a draft proposal', async () => {
			const comm = await seedCommunity(db, admin.id);
			const { proposal: prop } = await seedProposal(db, comm.id, admin.id, {
				status: 'draft',
				startTime: new Date(Date.now() + 3_600_000),
				endTime: new Date(Date.now() + 7_200_000),
				choices: ['Yes', 'No']
			});

			const handler = await createExecutionHandler(
				admin.id,
				{ proposalId: prop.id, type: 'webhook', config: { url: 'https://example.com/hook' } },
				db
			);

			expect(handler.proposalId).toBe(prop.id);
			expect(handler.type).toBe('webhook');
			expect(JSON.parse(handler.configJson)).toEqual({ url: 'https://example.com/hook' });
		});

		it('rejects non-draft proposals', async () => {
			const comm = await seedCommunity(db, admin.id);
			const { proposal: prop } = await seedProposal(db, comm.id, admin.id, {
				status: 'active',
				startTime: new Date(Date.now() - 60_000),
				endTime: new Date(Date.now() + 3_600_000),
				choices: ['Yes', 'No']
			});

			await expect(
				createExecutionHandler(
					admin.id,
					{ proposalId: prop.id, type: 'webhook', config: { url: 'https://example.com' } },
					db
				)
			).rejects.toThrow(ServiceError);
		});

		it('rejects unsupported handler types', async () => {
			const comm = await seedCommunity(db, admin.id);
			const { proposal: prop } = await seedProposal(db, comm.id, admin.id, {
				status: 'draft',
				startTime: new Date(Date.now() + 3_600_000),
				endTime: new Date(Date.now() + 7_200_000),
				choices: ['Yes', 'No']
			});

			await expect(
				createExecutionHandler(admin.id, { proposalId: prop.id, type: 'unknown', config: {} }, db)
			).rejects.toThrow(ServiceError);
		});
	});

	describe('getExecutionHandlers', () => {
		it('returns all handlers for a proposal', async () => {
			const comm = await seedCommunity(db, admin.id);
			const { proposal: prop } = await seedProposal(db, comm.id, admin.id, {
				status: 'draft',
				startTime: new Date(Date.now() + 3_600_000),
				endTime: new Date(Date.now() + 7_200_000),
				choices: ['Yes', 'No']
			});

			await createExecutionHandler(
				admin.id,
				{ proposalId: prop.id, type: 'webhook', config: { url: 'https://a.com' } },
				db
			);
			await createExecutionHandler(
				admin.id,
				{ proposalId: prop.id, type: 'webhook', config: { url: 'https://b.com' } },
				db
			);

			const handlers = await getExecutionHandlers(prop.id, db);
			expect(handlers).toHaveLength(2);
		});
	});

	describe('deleteExecutionHandler', () => {
		it('deletes a handler from a draft proposal', async () => {
			const comm = await seedCommunity(db, admin.id);
			const { proposal: prop } = await seedProposal(db, comm.id, admin.id, {
				status: 'draft',
				startTime: new Date(Date.now() + 3_600_000),
				endTime: new Date(Date.now() + 7_200_000),
				choices: ['Yes', 'No']
			});

			const handler = await createExecutionHandler(
				admin.id,
				{ proposalId: prop.id, type: 'webhook', config: { url: 'https://a.com' } },
				db
			);

			await deleteExecutionHandler(admin.id, handler.id, db);

			const remaining = await getExecutionHandlers(prop.id, db);
			expect(remaining).toHaveLength(0);
		});
	});

	describe('executeProposalHandlers', () => {
		const originalFetch = globalThis.fetch;

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		it('calls deliverWebhook for each webhook handler', async () => {
			globalThis.fetch = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));

			const comm = await seedCommunity(db, admin.id);
			const { proposal: prop } = await seedProposal(db, comm.id, admin.id, {
				status: 'draft',
				startTime: new Date(Date.now() + 3_600_000),
				endTime: new Date(Date.now() + 7_200_000),
				choices: ['Yes', 'No']
			});

			await createExecutionHandler(
				admin.id,
				{ proposalId: prop.id, type: 'webhook', config: { url: 'https://hook1.com' } },
				db
			);
			await createExecutionHandler(
				admin.id,
				{ proposalId: prop.id, type: 'webhook', config: { url: 'https://hook2.com' } },
				db
			);

			const results = {
				proposalId: prop.id,
				totalVotes: 5,
				results: [{ choiceId: 'ch1', label: 'Yes', votes: 5, votingPower: 5 }]
			};

			await executeProposalHandlers(prop.id, comm.id, results, db);

			expect(globalThis.fetch).toHaveBeenCalledTimes(2);
		});

		it('does nothing when no handlers exist', async () => {
			globalThis.fetch = vi.fn();

			const comm = await seedCommunity(db, admin.id);
			const { proposal: prop } = await seedProposal(db, comm.id, admin.id, {
				status: 'draft',
				startTime: new Date(Date.now() + 3_600_000),
				endTime: new Date(Date.now() + 7_200_000),
				choices: ['Yes', 'No']
			});

			const results = {
				proposalId: prop.id,
				totalVotes: 0,
				results: []
			};

			await executeProposalHandlers(prop.id, comm.id, results, db);

			expect(globalThis.fetch).not.toHaveBeenCalled();
		});
	});
});
