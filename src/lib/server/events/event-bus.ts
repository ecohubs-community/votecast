import type { EventName, EventDataMap, EventHandler, GovernanceEvent } from './types';

// ─── Internal state ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const subscribers = new Map<EventName, Set<EventHandler<any>>>();

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Emit a governance event.
 *
 * Wraps the data in a `{ event, timestamp, data }` envelope, then calls all
 * subscribed handlers via `Promise.allSettled()`. Handler failures are logged
 * but never propagate — the caller's operation has already succeeded.
 */
export function emit<E extends EventName>(event: E, data: EventDataMap[E]): void {
	const handlers = subscribers.get(event);
	if (!handlers || handlers.size === 0) return;

	const envelope = {
		event,
		timestamp: new Date().toISOString(),
		data
	} as Extract<GovernanceEvent, { event: E }>;

	// Fire-and-forget: run all handlers, log any failures
	void Promise.allSettled(
		[...handlers].map((handler) => {
			try {
				return Promise.resolve(handler(envelope));
			} catch (err) {
				// Synchronous throw inside a handler
				console.error(`[event-bus] Handler error for "${event}":`, err);
				return Promise.resolve();
			}
		})
	).then((results) => {
		for (const result of results) {
			if (result.status === 'rejected') {
				console.error(`[event-bus] Async handler error for "${event}":`, result.reason);
			}
		}
	});
}

/**
 * Subscribe to a governance event.
 *
 * Returns an unsubscribe function.
 */
export function subscribe<E extends EventName>(event: E, handler: EventHandler<E>): () => void {
	if (!subscribers.has(event)) {
		subscribers.set(event, new Set());
	}

	const handlers = subscribers.get(event)!;
	handlers.add(handler);

	return () => {
		handlers.delete(handler);
		if (handlers.size === 0) {
			subscribers.delete(event);
		}
	};
}

/**
 * Remove all subscribers. Used by tests to reset state between runs.
 */
export function clearSubscribers(): void {
	subscribers.clear();
}
