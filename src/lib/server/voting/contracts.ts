/**
 * Voting method contracts — Gate 1 deliverable for the `add-voting-methods-and-types` change.
 *
 * Pressure-testing the original single "Method Module" idea (design D2 — one module owning
 * `ballotSchema` + `validateVote` + `tallyVotes`) against four hard cases surfaced that `tallyVotes`
 * was conflating TWO axes from D1: the **ballot** (how a vote is shaped, validated, and aggregated)
 * and the **decision rule** (how aggregates become an outcome, including fallback escalation).
 *
 * They are split here so methods stay composable, e.g. "consent ballot + (consent → 2/3-majority
 * fallback) decision rule", or "ranked ballot + instant-runoff rule". A `CanonicalTally` is the
 * typed bridge between the two halves; a decision rule declares which tally family it consumes, so
 * incompatible pairings fail at the type level.
 *
 * This file is the CONTRACT only — types, no implementations. See design D1, D2, D9, D11.
 */

// ---------------------------------------------------------------------------
// Outcomes & results (D9 — tally output is a result-SET, not a single winner)
// ---------------------------------------------------------------------------

/** The result a proposal resolves to. `provisional`/`recorded` were added by the Gate-1 cases. */
export type OutcomeState =
	| 'passed'
	| 'failed'
	| 'blocked' // sustained paramount objection (consent/consensus)
	| 'tie'
	| 'quorum-not-met'
	| 'indeterminate'
	| 'provisional' // passed a phase but an async objection window is still open (consensus bylaw)
	| 'recorded'; // informational ballots with no single pass/fail (multi-question / sensemaking)

/** One line of a result — a winning choice, a per-question summary, or an elected seat. */
export interface ResultEntry {
	key: string; // choiceId, questionId, or seat index
	label: string;
	outcome: OutcomeState; // per-entry outcome (multi-question: each question resolves on its own)
	tallyForWeight: number;
	tallyAgainstWeight?: number;
	detail?: Record<string, unknown>; // module-specific (rank rounds, score sums, objection reasons)
}

export interface ResultSet {
	outcome: OutcomeState; // top-level; `recorded` when entries carry the meaning (multi-question)
	entries: ResultEntry[];
	participation: { eligibleCount: number; ballotsCast: number; quorumMet: boolean };
	rationale?: string; // human-readable, or returned by an external resolver
}

// ---------------------------------------------------------------------------
// CanonicalTally — the typed bridge from a ballot's aggregation to a decision rule.
// Tagged by family so a rule can declare what it accepts (a 2/3 rule needs counts; IRV needs
// rankings; consent needs positions). This is what made the four cases compose cleanly.
// ---------------------------------------------------------------------------

export interface OptionAggregate {
	optionId: string;
	group?: string; // questionId for multi-question ballots
	count: number;
	weight: number; // weighted by resolved voting power
	scoreSum?: number; // score/STAR ballots
}

export type CanonicalTally =
	| { family: 'count'; eligibleCount: number; ballotsCast: number; options: OptionAggregate[] }
	| {
			family: 'multiQuestion';
			eligibleCount: number;
			ballotsCast: number;
			options: OptionAggregate[];
	  }
	| { family: 'scored'; eligibleCount: number; ballotsCast: number; options: OptionAggregate[] }
	| {
			family: 'ranked';
			eligibleCount: number;
			ballotsCast: number;
			rankings: Array<{ weight: number; order: string[] }>;
	  }
	| {
			family: 'consent';
			eligibleCount: number;
			ballotsCast: number;
			positions: Array<{
				optionId?: string;
				position: 'consent' | 'stand-aside' | 'object';
				weight: number;
				reason?: string;
			}>;
	  };

export type TallyFamily = CanonicalTally['family'];

// ---------------------------------------------------------------------------
// Config knobs (D9) — generic knobs the engine may apply; each module/rule declares which it honors.
// ---------------------------------------------------------------------------

export type KnobId =
	| 'quorum'
	| 'passThreshold'
	| 'voteMutability'
	| 'ballotSecrecy'
	| 'tallyRevealTiming'
	| 'stopOnNthObjection'
	| 'absenceMeaning' // surfaced by the consensus bylaw: silence = consent vs. ignored
	| 'fallbackRule';

// ---------------------------------------------------------------------------
// Contexts passed in by the engine. The engine — NOT the module — resolves eligibility, voting
// power, phase transitions, and visibility (D1 axes 1/3/5/6). The module only sees resolved facts.
// ---------------------------------------------------------------------------

export interface BallotRecord<TSelection = unknown> {
	voterId: string;
	votingPower: number; // already resolved by the weight axis
	selections: TSelection[]; // one submission may carry many selections (approval, ranked, multi-question)
	submittedAt: number;
}

export interface VoteContext {
	proposalId: string;
	phase: 'draft' | 'deliberation' | 'voting' | 'objection-window' | 'finalized';
	voterEligible: boolean; // engine-resolved (eligibility axis)
	frozenOptions: Array<{ optionId: string; group?: string }>; // ballot frozen at voting-open (D10)
	existingBallotAt?: number; // for mutability checks
}

export interface TallyContext {
	config: Record<string, unknown>; // the method-config snapshot for this proposal/version
	phase: VoteContext['phase'];
	eligibleVoterCount: number; // needed for quorum AND absence-as-consent
	options: Array<{ optionId: string; group?: string; label?: string }>; // the frozen ballot options
	now: number;
}

export type VoteValidation = { ok: true } | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// The two split contracts.
// ---------------------------------------------------------------------------

/** A BALLOT MODULE owns the shape of a vote, its validation, and aggregation to a CanonicalTally. */
export interface BallotModule<TSelection = unknown> {
	id: string; // neutral code id: 'single-choice' | 'approval' | 'ranked' | 'score' | 'consent' | 'multi-question'
	tallyFamily: TallyFamily;
	honoredKnobs: KnobId[];

	/** Parse + validate one raw submission into typed selections (or reject). */
	validateVote(submission: unknown, ctx: VoteContext): VoteValidation;

	/** Aggregate all ballots into the canonical tally a decision rule will consume. */
	aggregate(ballots: BallotRecord<TSelection>[], ctx: TallyContext): CanonicalTally;

	components: { ballot: string; results: string }; // Svelte component module ids (lazy-loaded)
}

/** A DECISION RULE turns a CanonicalTally into a ResultSet. Composable: it may delegate to a fallback. */
export interface DecisionRule {
	id: string; // 'simple-majority' | 'super-majority' | 'consensus' | 'consensus-minus-n' | 'consent' | 'irv' | 'stv' | 'multi-question'
	accepts: TallyFamily; // must match the ballot module's tallyFamily
	honoredKnobs: KnobId[];

	/** Resolve an outcome. `fallback`, when present, is invoked per the rule's escalation policy. */
	resolve(tally: CanonicalTally, ctx: TallyContext, fallback?: DecisionRule): ResultSet;
}

/** A METHOD binds a ballot module + a decision rule (+ the cross-cutting axis config). */
export interface MethodBinding {
	ballotModuleId: string;
	decisionRuleId: string;
	fallbackRuleId?: string;
	config: Record<string, unknown>;
}
