/**
 * Facilitator capability (design D8). Several methods need a human who can see and act on objections
 * even under a hidden tally (stop-on-objection, paramount-objection judgement). `facilitator` is a
 * *future* role (06_auth_identity.md); for now its powers map to `admin`. Centralised here so the
 * mapping changes in one place when a distinct role lands.
 */
export type CommunityRole = 'admin' | 'member';

export function canFacilitate(role: CommunityRole): boolean {
	return role === 'admin';
}

/** Whether this viewer may see an otherwise-hidden tally / objection detail to run the method. */
export function canSeeHiddenTally(role: CommunityRole): boolean {
	return canFacilitate(role);
}
