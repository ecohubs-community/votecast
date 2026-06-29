/**
 * Weight axis (D1 axis 3 — the old `strategyId`'s real job). Resolves a voter's voting power.
 * `one-person-one-vote` ships concretely; the rest are typed stubs (one concrete impl now, others
 * land later — proposal scope boundary).
 */
export type WeightRule =
	| { kind: 'one-person-one-vote' }
	| { kind: 'token' }
	| { kind: 'quadratic' }
	| { kind: 'reputation' };

export interface WeightFacts {
	tokenBalance?: number;
	reputation?: number;
}

export function resolveVotingPower(rule: WeightRule, facts: WeightFacts = {}): number {
	switch (rule.kind) {
		case 'one-person-one-vote':
			return 1;
		case 'token':
			return Math.max(0, facts.tokenBalance ?? 0);
		case 'quadratic':
			return Math.floor(Math.sqrt(Math.max(0, facts.tokenBalance ?? 0)));
		case 'reputation':
			return Math.max(0, facts.reputation ?? 0);
	}
}
