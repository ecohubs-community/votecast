import type { EventHandler } from '../events';
import type { Plugin } from './types';
import { createNotification } from '../services/notification-service';

// Notifications plugin (task 6.5): writes a community-broadcast notification on key lifecycle events.
// It only ever links to the proposal — it never includes the tally, so hidden/secret results are not
// leaked through notifications (governance-events spec).

const onDeliberationStarted: EventHandler<'deliberation.started'> = (event) => {
	const { proposalId, communityId } = event.data;
	return createNotification({
		communityId,
		proposalId,
		event: event.event,
		title: 'Deliberation has started',
		body: 'A proposal is open for discussion before voting begins.'
	});
};

const onVotingStarted: EventHandler<'proposal.started'> = (event) => {
	const { proposalId, communityId } = event.data;
	return createNotification({
		communityId,
		proposalId,
		event: event.event,
		title: 'Voting is open',
		body: 'A proposal is now open for voting.'
	});
};

const onProposalClosed: EventHandler<'proposal.closed'> = (event) => {
	const { proposalId, communityId } = event.data;
	// Link only — never the tally (respects hidden/secret visibility).
	return createNotification({
		communityId,
		proposalId,
		event: event.event,
		title: 'Voting has closed',
		body: 'Results are available on the proposal.'
	});
};

const onProposalFinalized: EventHandler<'proposal.finalized'> = (event) => {
	const { proposalId, communityId } = event.data;
	return createNotification({
		communityId,
		proposalId,
		event: event.event,
		title: 'A decision is final',
		body: 'A proposal has been finalized.'
	});
};

export const notificationsPlugin: Plugin = {
	name: 'notifications',
	handlers: {
		'deliberation.started': onDeliberationStarted,
		'proposal.started': onVotingStarted,
		'proposal.closed': onProposalClosed,
		'proposal.finalized': onProposalFinalized
	}
};
