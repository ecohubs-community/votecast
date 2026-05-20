import { createHmac } from 'node:crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DeliveryResult {
	success: boolean;
	statusCode?: number;
	error?: string;
	attempts: number;
}

// ─── Configuration ──────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const TIMEOUT_MS = 5_000;
const BASE_DELAY_MS = 1_000; // Exponential backoff: 1s, 2s, 4s

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Deliver a webhook payload via HTTP POST with HMAC-SHA256 signature.
 *
 * Features:
 * - HMAC-SHA256 signature in `X-Webhook-Signature` header
 * - 5-second timeout per attempt
 * - Retry up to 3 times with exponential backoff (1s, 2s, 4s)
 * - Never throws — returns a DeliveryResult
 */
export async function deliverWebhook(
	url: string,
	secret: string,
	payload: object
): Promise<DeliveryResult> {
	const body = JSON.stringify(payload);
	const signature = createHmac('sha256', secret).update(body).digest('hex');

	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Webhook-Signature': `sha256=${signature}`
				},
				body,
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (response.ok) {
				return { success: true, statusCode: response.status, attempts: attempt };
			}

			// Non-retryable client errors (4xx except 429)
			if (response.status >= 400 && response.status < 500 && response.status !== 429) {
				console.error(`[webhook] Delivery failed (${response.status}) to ${url} — not retrying`);
				return {
					success: false,
					statusCode: response.status,
					error: `HTTP ${response.status}`,
					attempts: attempt
				};
			}

			// Server error or 429 — retry
			if (attempt < MAX_RETRIES) {
				const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
				await sleep(delay);
			}
		} catch (err) {
			const errorMessage =
				err instanceof Error && err.name === 'AbortError'
					? 'Request timed out'
					: err instanceof Error
						? err.message
						: 'Unknown error';

			if (attempt === MAX_RETRIES) {
				console.error(
					`[webhook] Delivery failed to ${url} after ${MAX_RETRIES} attempts: ${errorMessage}`
				);
				return { success: false, error: errorMessage, attempts: attempt };
			}

			const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
			await sleep(delay);
		}
	}

	// Should not reach here, but TypeScript needs it
	return { success: false, error: 'Max retries exhausted', attempts: MAX_RETRIES };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
