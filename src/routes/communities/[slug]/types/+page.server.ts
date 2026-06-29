import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getCommunityBySlug } from '$lib/server/services/community-service';
import { getMember } from '$lib/server/services/membership-service';
import { listProposalTypes } from '$lib/server/services/proposal-type-service';
import {
	createProposalType,
	setTypeRetired,
	listAllProposalTypes,
	METHOD_OPTIONS,
	methodFromOptionId
} from '$lib/server/services/proposal-type-admin-service';
import { ServiceError } from '$lib/server/services/errors';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) redirect(302, '/login');

	try {
		const community = await getCommunityBySlug(params.slug, locals.user.id);
		const membership = await getMember(community.id, locals.user.id);
		if (membership?.role !== 'admin') {
			error(403, 'Only community admins can manage proposal types');
		}

		const [types, summaries] = await Promise.all([
			listAllProposalTypes(community.id),
			listProposalTypes(community.id)
		]);
		// Join the active-type method summary onto the admin list.
		const summaryByType = new Map(summaries.map((s) => [s.typeId, s]));

		return {
			community,
			types: types.map((t) => ({
				id: t.id,
				name: t.name,
				description: t.description,
				retired: t.retiredAt !== null,
				summary: summaryByType.get(t.id) ?? null
			})),
			methodOptions: METHOD_OPTIONS
		};
	} catch (e) {
		if (e instanceof ServiceError) error(e.statusCode, e.message);
		throw e;
	}
};

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		if (!locals.user) redirect(302, '/login');
		const fd = await request.formData();
		const name = (fd.get('name') as string) ?? '';
		const description = (fd.get('description') as string) ?? '';
		const optionId = fd.get('methodOption') as string;
		const deliberationDays = Number(fd.get('deliberationDays') ?? 0) || 0;
		const tallyReveal =
			(fd.get('tallyReveal') as 'live' | 'on-close' | 'hidden-forever') || 'on-close';

		try {
			const community = await getCommunityBySlug(params.slug, locals.user.id);
			await createProposalType(locals.user.id, community.id, {
				name,
				description,
				method: methodFromOptionId(optionId, { deliberationDays, tallyReveal })
			});
			return { created: true };
		} catch (e) {
			if (e instanceof ServiceError) return fail(e.statusCode, { error: e.message, name });
			throw e;
		}
	},

	retire: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const fd = await request.formData();
		const typeId = fd.get('typeId') as string;
		const retired = fd.get('retired') === 'true';
		try {
			await setTypeRetired(locals.user.id, typeId, retired);
			return { updated: true };
		} catch (e) {
			if (e instanceof ServiceError) return fail(e.statusCode, { error: e.message });
			throw e;
		}
	}
};
