import type { ProposalResults } from '../services/proposal-service';

// ─── Event names ─────────────────────────────────────────────────────────────

export const EventName = {
	COMMUNITY_CREATED: 'community.created',
	COMMUNITY_DELETED: 'community.deleted',
	MEMBER_JOINED: 'member.joined',
	PROPOSAL_CREATED: 'proposal.created',
	// Lifecycle catalog (design D13). proposal.started/closed remain the voting open/close boundary.
	DELIBERATION_STARTED: 'deliberation.started',
	SUBQUESTION_ADDED: 'subquestion.added',
	PROPOSAL_STARTED: 'proposal.started', // = voting.started
	VOTE_CAST: 'vote.cast',
	OBJECTION_RAISED: 'objection.raised',
	VOTING_CLOSING_SOON: 'voting.closing-soon',
	PROPOSAL_CLOSED: 'proposal.closed', // = voting.closed
	OUTCOME_DECIDED: 'outcome.decided',
	PROPOSAL_FINALIZED: 'proposal.finalized'
} as const;

export type EventName = (typeof EventName)[keyof typeof EventName];

// ─── Event payloads ──────────────────────────────────────────────────────────

export interface CommunityCreatedData {
	communityId: string;
	createdBy: string;
}

export interface CommunityDeletedData {
	communityId: string;
	deletedBy: string;
}

export interface MemberJoinedData {
	communityId: string;
	userId: string;
}

export interface ProposalCreatedData {
	proposalId: string;
	communityId: string;
	createdBy: string;
}

export interface ProposalStartedData {
	proposalId: string;
	communityId: string;
}

export interface VoteCastData {
	voteId: string;
	proposalId: string;
	userId: string;
	choiceId: string;
}

export interface ProposalClosedData {
	proposalId: string;
	communityId: string;
	results: ProposalResults;
}

export interface DeliberationStartedData {
	proposalId: string;
	communityId: string;
}

export interface SubquestionAddedData {
	proposalId: string;
	communityId: string;
	questionId: string;
	addedBy: string;
}

export interface ObjectionRaisedData {
	proposalId: string;
	communityId: string;
	userId: string;
	reason?: string;
}

export interface VotingClosingSoonData {
	proposalId: string;
	communityId: string;
	endTime: string;
}

export interface OutcomeDecidedData {
	proposalId: string;
	communityId: string;
	outcome: string; // OutcomeState from the voting library
}

export interface ProposalFinalizedData {
	proposalId: string;
	communityId: string;
	outcome: string;
}

// ─── Discriminated union ─────────────────────────────────────────────────────

export type GovernanceEvent =
	| { event: 'community.created'; timestamp: string; data: CommunityCreatedData }
	| { event: 'community.deleted'; timestamp: string; data: CommunityDeletedData }
	| { event: 'member.joined'; timestamp: string; data: MemberJoinedData }
	| { event: 'proposal.created'; timestamp: string; data: ProposalCreatedData }
	| { event: 'deliberation.started'; timestamp: string; data: DeliberationStartedData }
	| { event: 'subquestion.added'; timestamp: string; data: SubquestionAddedData }
	| { event: 'proposal.started'; timestamp: string; data: ProposalStartedData }
	| { event: 'vote.cast'; timestamp: string; data: VoteCastData }
	| { event: 'objection.raised'; timestamp: string; data: ObjectionRaisedData }
	| { event: 'voting.closing-soon'; timestamp: string; data: VotingClosingSoonData }
	| { event: 'proposal.closed'; timestamp: string; data: ProposalClosedData }
	| { event: 'outcome.decided'; timestamp: string; data: OutcomeDecidedData }
	| { event: 'proposal.finalized'; timestamp: string; data: ProposalFinalizedData };

// ─── Handler type ────────────────────────────────────────────────────────────

/** Maps event names to their data types for type-safe emit/subscribe */
export interface EventDataMap {
	'community.created': CommunityCreatedData;
	'community.deleted': CommunityDeletedData;
	'member.joined': MemberJoinedData;
	'proposal.created': ProposalCreatedData;
	'deliberation.started': DeliberationStartedData;
	'subquestion.added': SubquestionAddedData;
	'proposal.started': ProposalStartedData;
	'vote.cast': VoteCastData;
	'objection.raised': ObjectionRaisedData;
	'voting.closing-soon': VotingClosingSoonData;
	'proposal.closed': ProposalClosedData;
	'outcome.decided': OutcomeDecidedData;
	'proposal.finalized': ProposalFinalizedData;
}

export type EventHandler<E extends EventName> = (
	event: Extract<GovernanceEvent, { event: E }>
) => void | Promise<void>;
