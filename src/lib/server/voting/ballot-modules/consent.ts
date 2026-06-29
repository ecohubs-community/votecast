import type { BallotModule, BallotRecord, CanonicalTally, TallyContext } from '../contracts';

export type ConsentPosition = 'consent' | 'stand-aside' | 'object';

/** One voter takes a single position; an objection must carry a reason (the consensus bylaw). */
export interface ConsentSelection {
	position: ConsentPosition;
	reason?: string;
}

function isConsent(s: unknown): s is ConsentSelection {
	const p = (s as { position?: unknown })?.position;
	return p === 'consent' || p === 'stand-aside' || p === 'object';
}

export const consentModule: BallotModule<ConsentSelection> = {
	id: 'consent',
	tallyFamily: 'consent',
	honoredKnobs: [
		'quorum',
		'voteMutability',
		'ballotSecrecy',
		'tallyRevealTiming',
		'stopOnNthObjection',
		'absenceMeaning',
		'fallbackRule'
	],

	validateVote(submission) {
		const selections = (submission as { selections?: unknown[] })?.selections;
		if (!Array.isArray(selections) || selections.length !== 1) {
			return { ok: false, reason: 'Take exactly one position.' };
		}
		const sel = selections[0];
		if (!isConsent(sel)) return { ok: false, reason: 'Malformed position.' };
		// A blocking objection must be reasoned (must demonstrate why) — consent spec.
		if (sel.position === 'object' && !sel.reason?.trim()) {
			return { ok: false, reason: 'An objection must include a reason.' };
		}
		return { ok: true };
	},

	aggregate(ballots: BallotRecord<ConsentSelection>[], ctx: TallyContext): CanonicalTally {
		const positions = [];
		for (const b of ballots) {
			const sel = b.selections[0];
			if (!isConsent(sel)) continue;
			positions.push({ position: sel.position, reason: sel.reason, weight: b.votingPower });
		}
		return {
			family: 'consent',
			eligibleCount: ctx.eligibleVoterCount,
			ballotsCast: positions.length,
			positions
		};
	},

	components: { ballot: 'ConsentBallot', results: 'ConsentResults' }
};
