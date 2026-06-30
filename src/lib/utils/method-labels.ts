// Human-readable labels for method axes — shared by the process-flow diagram and the proposal/type
// summaries so the wording never drifts between surfaces.

const BALLOT_LABELS: Record<string, string> = {
	'single-choice': 'Single choice',
	consent: 'Consent',
	'multi-question': 'Common Ground'
};

const RULE_LABELS: Record<string, string> = {
	'simple-majority': 'simple majority',
	'absolute-majority': 'absolute majority',
	'super-majority': 'two-thirds majority',
	consensus: 'consensus',
	'consensus-minus-1': 'consensus −1',
	consent: 'consent',
	'multi-question': 'per-question'
};

const TALLY_REVEAL_LABELS: Record<string, string> = {
	live: 'Results visible live',
	'on-close': 'Results after voting closes',
	'hidden-forever': 'Results hidden (facilitators only)'
};

export function ballotLabel(id: string): string {
	return BALLOT_LABELS[id] ?? id;
}

export function ruleLabel(id: string): string {
	return RULE_LABELS[id] ?? id;
}

export function tallyRevealLabel(reveal: string): string {
	return TALLY_REVEAL_LABELS[reveal] ?? reveal;
}
