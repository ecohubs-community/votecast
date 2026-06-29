import { describe, it, expect } from 'vitest';
import { callExternalResolver } from './external-resolver';
import type { CanonicalTally } from './contracts';

const config = { url: 'https://resolver.example/decide', secret: 'whsec_test' };
const tally: CanonicalTally = {
	family: 'count',
	eligibleCount: 3,
	ballotsCast: 2,
	options: [{ optionId: 'A', count: 2, weight: 2 }]
};
const ctx = { proposalId: 'p1', nonce: 'n1', issuedAt: 0 };

describe('callExternalResolver', () => {
	it('applies a valid resolver outcome and signs the request', async () => {
		let seenSig: string | undefined;
		let seenBody: string | undefined;
		const fetchImpl = (async (_url: string, init: RequestInit) => {
			seenSig = (init.headers as Record<string, string>)['X-Resolver-Signature'];
			seenBody = init.body as string;
			return { ok: true, json: async () => ({ outcome: 'passed', rationale: 'quorum reached' }) };
		}) as unknown as typeof fetch;

		const r = await callExternalResolver(config, tally, ctx, { fetchImpl });
		expect(r).toEqual({ delegated: true, outcome: 'passed', rationale: 'quorum reached' });
		expect(seenSig).toMatch(/^sha256=/);
		// Data minimization: the payload carries the aggregate tally, never per-member ballots.
		expect(seenBody).toContain('"tally"');
		expect(seenBody).not.toContain('voterId');
	});

	it('falls back on a non-2xx response', async () => {
		const fetchImpl = (async () => ({
			ok: false,
			status: 500,
			json: async () => ({})
		})) as unknown as typeof fetch;
		const r = await callExternalResolver(config, tally, ctx, { fetchImpl });
		expect(r.delegated).toBe(false);
		expect(r.outcome).toBe('indeterminate');
	});

	it('falls back on an invalid outcome value', async () => {
		const fetchImpl = (async () => ({
			ok: true,
			json: async () => ({ outcome: 'banana' })
		})) as unknown as typeof fetch;
		const r = await callExternalResolver(config, tally, ctx, { fetchImpl });
		expect(r.delegated).toBe(false);
		expect(r.outcome).toBe('indeterminate');
	});

	it('falls back when the resolver is unreachable', async () => {
		const fetchImpl = (async () => {
			throw new Error('ECONNREFUSED');
		}) as unknown as typeof fetch;
		const r = await callExternalResolver(config, tally, ctx, { fetchImpl });
		expect(r).toMatchObject({ delegated: false, outcome: 'indeterminate' });
	});
});
