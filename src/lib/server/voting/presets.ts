import type { MethodBinding } from './contracts';
import type { EligibilityRule } from './eligibility';
import type { WeightRule } from './weight';

/**
 * A frozen method snapshot (stored as JSON on a proposal_type_version — design D4/D12). It carries
 * the ballot+rule binding plus the cross-cutting axes the engine applies around the module.
 */
export interface MethodSnapshot {
	ballotModuleId: string;
	decisionRuleId: string;
	fallbackRuleId?: string;
	eligibility: EligibilityRule;
	weight: WeightRule;
	visibility: { tallyReveal: 'live' | 'on-close' | 'hidden-forever'; secretBallot: boolean };
	process: { objectionWindowSeconds?: number };
	config: Record<string, unknown>; // honored knobs (quorum, passThreshold, absenceMeaning, …)
}

/** Extract just the dispatch binding (ballot + rule + config) from a snapshot. */
export function bindingFromSnapshot(s: MethodSnapshot): MethodBinding {
	return {
		ballotModuleId: s.ballotModuleId,
		decisionRuleId: s.decisionRuleId,
		fallbackRuleId: s.fallbackRuleId,
		config: s.config
	};
}

const ONE_DAY = 86_400;
const SEVEN_DAYS = 7 * ONE_DAY;
const FOURTEEN_DAYS = 14 * ONE_DAY;

export interface PresetType {
	name: string;
	description: string;
	deliberationSeconds: number;
	snapshot: MethodSnapshot;
}

/** The 1–3 preset types seeded into every community (proposal-types spec). */
export const PRESET_TYPES: PresetType[] = [
	{
		name: 'Quick poll',
		description: 'Simple majority, votes visible live, no deliberation period.',
		deliberationSeconds: 0,
		snapshot: {
			ballotModuleId: 'single-choice',
			decisionRuleId: 'simple-majority',
			eligibility: { kind: 'all-members' },
			weight: { kind: 'one-person-one-vote' },
			visibility: { tallyReveal: 'live', secretBallot: false },
			process: {},
			config: {}
		}
	},
	{
		name: 'Operational',
		description: 'Two-thirds majority with a one-day deliberation period; results on close.',
		deliberationSeconds: ONE_DAY,
		snapshot: {
			ballotModuleId: 'single-choice',
			decisionRuleId: 'super-majority',
			eligibility: { kind: 'all-members' },
			weight: { kind: 'one-person-one-vote' },
			visibility: { tallyReveal: 'on-close', secretBallot: false },
			process: {},
			config: {}
		}
	},
	{
		name: 'Constitutional',
		description: 'Consent (consensus) with a week of deliberation and a two-week objection window.',
		deliberationSeconds: SEVEN_DAYS,
		snapshot: {
			ballotModuleId: 'consent',
			decisionRuleId: 'consensus',
			eligibility: { kind: 'all-members' },
			weight: { kind: 'one-person-one-vote' },
			visibility: { tallyReveal: 'on-close', secretBallot: false },
			process: { objectionWindowSeconds: FOURTEEN_DAYS },
			config: { absenceMeaning: 'ignore' }
		}
	}
];

/** The method existing (pre-change) proposals are back-filled to — the onePersonOneVote equivalent. */
export const LEGACY_SNAPSHOT: MethodSnapshot = PRESET_TYPES[0].snapshot;
