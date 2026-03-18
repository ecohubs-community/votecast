import { error, fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import {
	getCommunityBySlug,
	updateCommunity,
	deleteCommunity
} from '$lib/server/services/community-service';
import {
	requireAdmin,
	listMembers,
	removeMember,
	updateMemberRole
} from '$lib/server/services/membership-service';
import { ServiceError } from '$lib/server/services/errors';
import { db } from '$lib/server/db';
import { webhook } from '$lib/server/db/governance.schema';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		redirect(302, '/login');
	}

	try {
		const community = await getCommunityBySlug(params.slug, locals.user.id);
		await requireAdmin(community.id, locals.user.id);

		const [members, webhooks] = await Promise.all([
			listMembers(community.id, { limit: 100 }),
			db.select().from(webhook).where(eq(webhook.communityId, community.id)).all()
		]);

		const webhookItems = webhooks.map((w) => ({
			id: w.id,
			url: w.url,
			events: JSON.parse(w.events) as string[],
			active: w.active,
			createdAt: w.createdAt
		}));

		return {
			community,
			members,
			webhooks: webhookItems
		};
	} catch (e) {
		if (e instanceof ServiceError) {
			error(e.statusCode, e.message);
		}
		throw e;
	}
};

export const actions: Actions = {
	updateGeneral: async ({ request, locals, params }) => {
		if (!locals.user) redirect(302, '/login');

		const formData = await request.formData();
		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const visibility = formData.get('visibility') as string;

		try {
			const community = await getCommunityBySlug(params.slug, locals.user.id);
			await updateCommunity(locals.user.id, community.id, {
				name: name || undefined,
				description: description ?? undefined,
				visibility: (visibility as 'public' | 'community') || undefined
			});
			return { generalSuccess: true };
		} catch (e) {
			if (e instanceof ServiceError) {
				return fail(e.statusCode, { generalError: e.message });
			}
			throw e;
		}
	},

	updateRole: async ({ request, locals, params }) => {
		if (!locals.user) redirect(302, '/login');

		const formData = await request.formData();
		const targetUserId = formData.get('userId') as string;
		const newRole = formData.get('role') as 'admin' | 'member';

		try {
			const community = await getCommunityBySlug(params.slug, locals.user.id);
			await updateMemberRole(locals.user.id, community.id, targetUserId, newRole);
			return { memberSuccess: true };
		} catch (e) {
			if (e instanceof ServiceError) {
				return fail(e.statusCode, { memberError: e.message });
			}
			throw e;
		}
	},

	removeMember: async ({ request, locals, params }) => {
		if (!locals.user) redirect(302, '/login');

		const formData = await request.formData();
		const targetUserId = formData.get('userId') as string;

		try {
			const community = await getCommunityBySlug(params.slug, locals.user.id);
			await removeMember(locals.user.id, community.id, targetUserId);
			return { memberSuccess: true };
		} catch (e) {
			if (e instanceof ServiceError) {
				return fail(e.statusCode, { memberError: e.message });
			}
			throw e;
		}
	},

	deleteCommunity: async ({ locals, params }) => {
		if (!locals.user) redirect(302, '/login');

		try {
			const community = await getCommunityBySlug(params.slug, locals.user.id);
			await deleteCommunity(locals.user.id, community.id);
		} catch (e) {
			if (e instanceof ServiceError) {
				return fail(e.statusCode, { dangerError: e.message });
			}
			throw e;
		}

		redirect(303, '/');
	}
};
