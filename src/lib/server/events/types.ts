import type { ProposalResults } from '../services/proposal-service';

// ─── Event names ─────────────────────────────────────────────────────────────

export const EventName = {
	COMMUNITY_CREATED: 'community.created',
	COMMUNITY_DELETED: 'community.deleted',
	MEMBER_JOINED: 'member.joined',
	PROPOSAL_CREATED: 'proposal.created',
	PROPOSAL_STARTED: 'proposal.started',
	VOTE_CAST: 'vote.cast',
	PROPOSAL_CLOSED: 'proposal.closed'
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

// ─── Discriminated union ─────────────────────────────────────────────────────

export type GovernanceEvent =
	| { event: 'community.created'; timestamp: string; data: CommunityCreatedData }
	| { event: 'community.deleted'; timestamp: string; data: CommunityDeletedData }
	| { event: 'member.joined'; timestamp: string; data: MemberJoinedData }
	| { event: 'proposal.created'; timestamp: string; data: ProposalCreatedData }
	| { event: 'proposal.started'; timestamp: string; data: ProposalStartedData }
	| { event: 'vote.cast'; timestamp: string; data: VoteCastData }
	| { event: 'proposal.closed'; timestamp: string; data: ProposalClosedData };

// ─── Handler type ────────────────────────────────────────────────────────────

/** Maps event names to their data types for type-safe emit/subscribe */
export interface EventDataMap {
	'community.created': CommunityCreatedData;
	'community.deleted': CommunityDeletedData;
	'member.joined': MemberJoinedData;
	'proposal.created': ProposalCreatedData;
	'proposal.started': ProposalStartedData;
	'vote.cast': VoteCastData;
	'proposal.closed': ProposalClosedData;
}

export type EventHandler<E extends EventName> = (
	event: Extract<GovernanceEvent, { event: E }>
) => void | Promise<void>;
