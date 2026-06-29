import { eq, and, or, isNull, desc, inArray } from 'drizzle-orm';
import { db as defaultDb } from '$lib/server/db';
import { communityMember, notification } from '$lib/server/db/schema';
import type { Database } from './types';

export interface CreateNotificationInput {
	communityId: string;
	userId?: string | null; // null/undefined = broadcast to all community members
	proposalId?: string | null;
	event: string;
	title: string;
	body?: string;
}

/**
 * Minimal in-app notification sink (design D13 / task 6.5). Writes a notification row; rich delivery
 * channels (email/push/Discord) are a separate dependency. The event emission never depends on a
 * transport — this is just a DB write.
 */
export async function createNotification(
	input: CreateNotificationInput,
	db: Database = defaultDb
): Promise<void> {
	await db.insert(notification).values({
		communityId: input.communityId,
		userId: input.userId ?? null,
		proposalId: input.proposalId ?? null,
		event: input.event,
		title: input.title,
		body: input.body ?? ''
	});
}

/**
 * List a user's notifications: direct ones (userId = user) plus broadcasts (userId null) for any
 * community the user belongs to, newest first.
 */
export async function listNotifications(userId: string, db: Database = defaultDb, limit = 50) {
	const memberships = await db
		.select({ communityId: communityMember.communityId })
		.from(communityMember)
		.where(eq(communityMember.userId, userId));
	const communityIds = memberships.map((m) => m.communityId);

	const broadcastCond =
		communityIds.length > 0
			? and(isNull(notification.userId), inArray(notification.communityId, communityIds))
			: undefined;

	return db
		.select()
		.from(notification)
		.where(
			broadcastCond
				? or(eq(notification.userId, userId), broadcastCond)
				: eq(notification.userId, userId)
		)
		.orderBy(desc(notification.createdAt))
		.limit(limit);
}

/** Mark a direct notification read (only the owning user). Returns true if a row was updated. */
export async function markNotificationRead(
	notificationId: string,
	userId: string,
	db: Database = defaultDb
): Promise<boolean> {
	const updated = await db
		.update(notification)
		.set({ readAt: new Date() })
		.where(and(eq(notification.id, notificationId), eq(notification.userId, userId)))
		.returning({ id: notification.id });
	return updated.length > 0;
}
