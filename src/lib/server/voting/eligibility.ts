/**
 * Eligibility axis (D1 axis 1). The engine resolves the voter facts (membership, training, balances)
 * and this pure function decides whether the vote counts. `all-members` + `trained` ship concretely;
 * `token`/`reputation` are typed stubs until those data sources land (proposal scope boundary).
 */
export type EligibilityRule =
	| { kind: 'all-members' }
	| { kind: 'trained' }
	| { kind: 'token'; minBalance: number }
	| { kind: 'reputation'; minScore: number };

export interface VoterFacts {
	isMember: boolean;
	isTrained?: boolean; // completed the required training/quiz gate
	tokenBalance?: number;
	reputation?: number;
}

export function isEligible(rule: EligibilityRule, facts: VoterFacts): boolean {
	switch (rule.kind) {
		case 'all-members':
			return facts.isMember;
		case 'trained':
			return facts.isMember && facts.isTrained === true;
		case 'token':
			return facts.isMember && (facts.tokenBalance ?? 0) >= rule.minBalance;
		case 'reputation':
			return facts.isMember && (facts.reputation ?? 0) >= rule.minScore;
	}
}
