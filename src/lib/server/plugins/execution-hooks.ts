import { eq, and } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { webhook, proposal } from '$lib/server/db/schema';
import { executeProposalHandlers } from '../services/execution-service';
import { deliverWebhook } from '../services/webhook-delivery';
import type { Plugin } from './types';
import type { GovernanceEvent } from '../events';

// ─── Execution hooks plugin ─────────────────────────────────────────────────

/**
 * Subscribes to `proposal.closed` and runs per-proposal execution handlers.
 */
export const executionHooksPlugin: Plugin = {
	name: 'executionHooks',
	handlers: {
		'proposal.closed': async (event) => {
			const { proposalId, communityId, results } = event.data;
			await executeProposalHandlers(proposalId, communityId, results);
		}
	}
};

// ─── Community webhook delivery plugin ──────────────────────────────────────

/**
 * Delivers events to community-registered webhooks.
 *
 * Subscribes to all event types. For each event, finds active community
 * webhooks that include the event name in their subscribed events list,
 * then delivers the event payload to each.
 */
export const webhookDeliveryPlugin: Plugin = {
	name: 'webhookDelivery',
	handlers: {
		'community.created': (event) => deliverToWebhooks(event.data.communityId, event),
		'member.joined': (event) => deliverToWebhooks(event.data.communityId, event),
		'proposal.created': (event) => deliverToWebhooks(event.data.communityId, event),
		'proposal.started': (event) => deliverToWebhooks(event.data.communityId, event),
		'vote.cast': async (event) => {
			// vote.cast doesn't carry communityId — look up via proposal
			const communityId = await resolveVoteCommunityId(event.data.proposalId);
			if (communityId) {
				await deliverToWebhooks(communityId, event);
			}
		},
		'proposal.closed': (event) => deliverToWebhooks(event.data.communityId, event)
	}
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Find active webhooks for a community that subscribe to the given event,
 * and deliver the event payload to each.
 */
async function deliverToWebhooks(communityId: string, event: GovernanceEvent): Promise<void> {
	const webhooks = db
		.select()
		.from(webhook)
		.where(and(eq(webhook.communityId, communityId), eq(webhook.active, true)))
		.all();

	if (webhooks.length === 0) return;

	const payload = {
		event: event.event,
		timestamp: event.timestamp,
		data: event.data
	};

	const deliveries = webhooks
		.filter((w) => {
			const subscribedEvents = JSON.parse(w.events) as string[];
			return subscribedEvents.includes(event.event);
		})
		.map(async (w) => {
			try {
				const result = await deliverWebhook(w.url, w.secret, payload);
				if (!result.success) {
					console.error(
						`[webhook-delivery] Failed to deliver ${event.event} to ${w.url}: ${result.error}`
					);
				}
			} catch (err) {
				console.error(
					`[webhook-delivery] Unexpected error delivering to ${w.url}:`,
					err instanceof Error ? err.message : err
				);
			}
		});

	await Promise.allSettled(deliveries);
}

/**
 * Look up the communityId for a proposal (used by vote.cast events).
 */
async function resolveVoteCommunityId(proposalId: string): Promise<string | null> {
	const [found] = db
		.select({ communityId: proposal.communityId })
		.from(proposal)
		.where(eq(proposal.id, proposalId))
		.limit(1)
		.all();

	return found?.communityId ?? null;
}
