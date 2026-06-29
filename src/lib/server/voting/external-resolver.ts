import { createHmac } from 'node:crypto';
import type { CanonicalTally, OutcomeState } from './contracts';

/**
 * External resolver boundary (design D5/D13, task 6.6). For fully custom decision logic, a community
 * hosts code matching this interface; we POST a signed, time-bounded payload of the *aggregate* tally
 * (never per-member ballots — data minimization is satisfied by construction, since CanonicalTally
 * carries no voter identities) and read back `{ outcome, rationale }`.
 *
 * We never execute community-supplied code in-process. On any failure (non-2xx, malformed response,
 * timeout, network error) this returns `delegated: false` so the caller applies the method's fallback
 * rule, or `indeterminate` if none.
 */
export interface ExternalResolverConfig {
	url: string;
	secret: string;
}

export interface ExternalResolverResult {
	delegated: boolean; // true = the resolver returned a valid outcome; false = we fell back
	outcome: OutcomeState;
	rationale?: string;
}

const VALID_OUTCOMES = new Set<OutcomeState>([
	'passed',
	'failed',
	'blocked',
	'tie',
	'quorum-not-met',
	'indeterminate',
	'provisional',
	'recorded'
]);

export async function callExternalResolver(
	config: ExternalResolverConfig,
	tally: CanonicalTally,
	ctx: { proposalId: string; nonce: string; issuedAt: number },
	opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<ExternalResolverResult> {
	const fetchImpl = opts.fetchImpl ?? fetch;
	const timeoutMs = opts.timeoutMs ?? 10_000;

	const body = JSON.stringify({
		proposalId: ctx.proposalId,
		tally, // aggregates only
		nonce: ctx.nonce,
		issuedAt: ctx.issuedAt
	});
	const signature = createHmac('sha256', config.secret).update(body).digest('hex');

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetchImpl(config.url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Resolver-Signature': `sha256=${signature}`
			},
			body,
			signal: controller.signal
		});
		if (!res.ok) {
			return {
				delegated: false,
				outcome: 'indeterminate',
				rationale: `resolver returned ${res.status}`
			};
		}
		const json = (await res.json()) as { outcome?: unknown; rationale?: unknown };
		if (typeof json?.outcome !== 'string' || !VALID_OUTCOMES.has(json.outcome as OutcomeState)) {
			return { delegated: false, outcome: 'indeterminate', rationale: 'invalid resolver response' };
		}
		return {
			delegated: true,
			outcome: json.outcome as OutcomeState,
			rationale: typeof json.rationale === 'string' ? json.rationale : undefined
		};
	} catch (err) {
		const aborted = err instanceof Error && err.name === 'AbortError';
		return {
			delegated: false,
			outcome: 'indeterminate',
			rationale: aborted ? 'resolver timed out' : 'resolver unreachable'
		};
	} finally {
		clearTimeout(timer);
	}
}
