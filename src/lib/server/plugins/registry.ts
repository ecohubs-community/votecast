import { subscribe } from '../events';
import type { EventName, EventHandler } from '../events';
import type { Plugin } from './types';
import { votingAnalyticsPlugin } from './voting-analytics';
import { executionHooksPlugin, webhookDeliveryPlugin } from './execution-hooks';
import { notificationsPlugin } from './notifications';

// ─── Internal state ─────────────────────────────────────────────────────────

const registeredPlugins: Plugin[] = [];
const unsubscribeFns: Array<() => void> = [];

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Register a plugin by wiring its handlers to the event bus.
 *
 * Duplicate plugins (by name) are silently skipped.
 */
export function registerPlugin(plugin: Plugin): void {
	if (registeredPlugins.some((p) => p.name === plugin.name)) {
		console.warn(`[plugins] Plugin "${plugin.name}" is already registered, skipping.`);
		return;
	}

	for (const [eventName, handler] of Object.entries(plugin.handlers)) {
		if (handler) {
			// Cast is safe: PluginHandlers mapped type guarantees handler matches event
			const unsub = subscribe(
				eventName as EventName,
				handler as EventHandler<typeof eventName & EventName>
			);
			unsubscribeFns.push(unsub);
		}
	}

	registeredPlugins.push(plugin);
	console.log(`[plugins] Registered plugin: ${plugin.name}`);
}

/**
 * Initialize all built-in plugins.
 *
 * Called once at server startup from hooks.server.ts.
 */
export function initPlugins(): void {
	registerPlugin(votingAnalyticsPlugin);
	registerPlugin(executionHooksPlugin);
	registerPlugin(webhookDeliveryPlugin);
	registerPlugin(notificationsPlugin);
}

/**
 * Remove all registered plugins and their event subscriptions.
 * Used by tests to reset state between runs.
 */
export function clearPlugins(): void {
	for (const unsub of unsubscribeFns) {
		unsub();
	}
	unsubscribeFns.length = 0;
	registeredPlugins.length = 0;
}

/**
 * Returns the names of all registered plugins.
 */
export function getRegisteredPlugins(): readonly string[] {
	return registeredPlugins.map((p) => p.name);
}
