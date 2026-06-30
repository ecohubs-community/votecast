import { eq } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import { executionHandler, proposal } from '$lib/server/db/schema';
import { ServiceError, ErrorCode } from './errors';
import { requireAdmin } from './membership-service';
import { deliverWebhook } from './webhook-delivery';
import type { ProposalResults } from './proposal-service';
import type { Database } from './types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreateExecutionHandlerInput {
	proposalId: string;
	type: string;
	config: Record<string, unknown>;
}

export interface ExecutionHandlerRecord {
	id: string;
	proposalId: string;
	type: string;
	configJson: string;
	createdAt: Date;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Create an execution handler for a proposal.
 *
 * Only the proposal creator or a community admin may add handlers.
 * The proposal must be in `draft` status.
 */
export async function createExecutionHandler(
	userId: string,
	input: CreateExecutionHandlerInput,
	db: Database = defaultDb
): Promise<ExecutionHandlerRecord> {
	// Validate type
	const SUPPORTED_TYPES = ['webhook'];
	if (!SUPPORTED_TYPES.includes(input.type)) {
		throw new ServiceError(
			ErrorCode.INVALID_REQUEST,
			`Unsupported execution handler type: ${input.type}. Supported: ${SUPPORTED_TYPES.join(', ')}`
		);
	}

	// Validate webhook config
	if (input.type === 'webhook') {
		const url = input.config.url;
		if (!url || typeof url !== 'string') {
			throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Webhook handler requires a valid url');
		}
		try {
			new URL(url);
		} catch {
			throw new ServiceError(ErrorCode.INVALID_REQUEST, 'Invalid webhook URL');
		}
	}

	// Fetch proposal and check status
	const [found] = await db
		.select()
		.from(proposal)
		.where(eq(proposal.id, input.proposalId))
		.limit(1);

	if (!found) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'Proposal not found');
	}

	if (found.phase !== 'draft' && found.phase !== 'deliberation') {
		throw new ServiceError(
			ErrorCode.PROPOSAL_NOT_EDITABLE,
			'Execution handlers can only be added before voting opens'
		);
	}

	// Check permission: must be creator or community admin
	if (found.createdBy !== userId) {
		await requireAdmin(found.communityId, userId, db);
	}

	const [created] = await db
		.insert(executionHandler)
		.values({
			proposalId: input.proposalId,
			type: input.type,
			configJson: JSON.stringify(input.config)
		})
		.returning();

	return created;
}

/**
 * Get all execution handlers for a proposal.
 */
export async function getExecutionHandlers(
	proposalId: string,
	db: Database = defaultDb
): Promise<ExecutionHandlerRecord[]> {
	return db
		.select()
		.from(executionHandler)
		.where(eq(executionHandler.proposalId, proposalId))
		.all();
}

/**
 * Delete an execution handler.
 *
 * The proposal must be in `draft` status.
 */
export async function deleteExecutionHandler(
	userId: string,
	handlerId: string,
	db: Database = defaultDb
): Promise<void> {
	const [handler] = await db
		.select()
		.from(executionHandler)
		.where(eq(executionHandler.id, handlerId))
		.limit(1);

	if (!handler) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'Execution handler not found');
	}

	const [prop] = await db
		.select()
		.from(proposal)
		.where(eq(proposal.id, handler.proposalId))
		.limit(1);

	if (!prop) {
		throw new ServiceError(ErrorCode.NOT_FOUND, 'Proposal not found');
	}

	if (prop.phase !== 'draft' && prop.phase !== 'deliberation') {
		throw new ServiceError(
			ErrorCode.PROPOSAL_NOT_EDITABLE,
			'Execution handlers can only be removed before voting opens'
		);
	}

	// Check permission: must be creator or community admin
	if (prop.createdBy !== userId) {
		await requireAdmin(prop.communityId, userId, db);
	}

	await db.delete(executionHandler).where(eq(executionHandler.id, handlerId));
}

/**
 * Execute all handlers for a closed proposal.
 *
 * Called by the execution hooks plugin when `proposal.closed` fires.
 * Errors are logged but never thrown — execution failures must not
 * break proposal closure.
 */
export async function executeProposalHandlers(
	proposalId: string,
	communityId: string,
	results: ProposalResults,
	db: Database = defaultDb
): Promise<void> {
	const handlers = await getExecutionHandlers(proposalId, db);

	if (handlers.length === 0) return;

	const payload = {
		event: 'proposal.closed',
		timestamp: new Date().toISOString(),
		data: { proposalId, communityId, results }
	};

	const deliveries = handlers.map(async (handler) => {
		try {
			if (handler.type === 'webhook') {
				const config = JSON.parse(handler.configJson) as { url: string };
				// Use handler ID as part of the signing secret for traceability
				const secret = `exec_${handler.id}`;
				const result = await deliverWebhook(config.url, secret, payload);

				if (!result.success) {
					console.error(
						`[execution] Handler ${handler.id} failed for proposal ${proposalId}: ${result.error}`
					);
				}
			} else {
				console.warn(`[execution] Unknown handler type "${handler.type}" — skipping`);
			}
		} catch (err) {
			console.error(
				`[execution] Unexpected error in handler ${handler.id}:`,
				err instanceof Error ? err.message : err
			);
		}
	});

	await Promise.allSettled(deliveries);
}
