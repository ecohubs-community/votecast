import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { requireAuth, success, handleError, parseBody } from '$lib/server/api-utils';
import { requireAdmin } from '$lib/server/services/membership-service';
import { ServiceError, ErrorCode } from '$lib/server/services/errors';
import { db } from '$lib/server/db';
import { webhook } from '$lib/server/db/governance.schema';

/** DELETE /api/communities/:id/webhooks/:webhookId — delete a webhook. Admin required. */
export const DELETE: RequestHandler = async ({ locals, params }) => {
	try {
		const user = requireAuth(locals);
		await requireAdmin(params.id, user.id);

		const result = db
			.delete(webhook)
			.where(and(eq(webhook.id, params.webhookId), eq(webhook.communityId, params.id)))
			.returning()
			.get();

		if (!result) {
			throw new ServiceError(ErrorCode.NOT_FOUND, 'Webhook not found');
		}

		return success({ deleted: true });
	} catch (error) {
		return handleError(error);
	}
};

/** PATCH /api/communities/:id/webhooks/:webhookId — toggle webhook active state. Admin required. */
export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	try {
		const user = requireAuth(locals);
		await requireAdmin(params.id, user.id);

		const body = await parseBody<{ active?: boolean }>(request);

		if (typeof body.active !== 'boolean') {
			throw new ServiceError(ErrorCode.INVALID_REQUEST, 'active must be a boolean');
		}

		const [updated] = await db
			.update(webhook)
			.set({ active: body.active })
			.where(and(eq(webhook.id, params.webhookId), eq(webhook.communityId, params.id)))
			.returning();

		if (!updated) {
			throw new ServiceError(ErrorCode.NOT_FOUND, 'Webhook not found');
		}

		return success({
			id: updated.id,
			url: updated.url,
			events: JSON.parse(updated.events) as string[],
			active: updated.active
		});
	} catch (error) {
		return handleError(error);
	}
};
