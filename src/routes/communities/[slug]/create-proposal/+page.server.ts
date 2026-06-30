import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getCommunityBySlug } from '$lib/server/services/community-service';
import { createProposal } from '$lib/server/services/proposal-service';
import { getMember } from '$lib/server/services/membership-service';
import { listProposalTypes } from '$lib/server/services/proposal-type-service';
import { ServiceError } from '$lib/server/services/errors';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		redirect(302, '/login');
	}

	try {
		const community = await getCommunityBySlug(params.slug, locals.user.id);
		const membership = await getMember(community.id, locals.user.id);

		if (!membership) {
			error(403, 'You must be a member to create proposals');
		}

		const types = await listProposalTypes(community.id);

		return { community, types };
	} catch (e) {
		if (e instanceof ServiceError) {
			error(e.statusCode, e.message);
		}
		throw e;
	}
};

export const actions: Actions = {
	default: async ({ request, locals, params }) => {
		if (!locals.user) {
			redirect(302, '/login');
		}

		const formData = await request.formData();

		const title = formData.get('title') as string;
		const body = formData.get('body') as string;
		const rationale = ((formData.get('rationale') as string) || '').trim() || undefined;
		const choices = formData
			.getAll('choices')
			.filter((c) => (c as string).trim() !== '') as string[];
		const questions = formData
			.getAll('questions')
			.filter((q) => (q as string).trim() !== '') as string[];
		const startTime = formData.get('startTime') as string;
		const endTime = formData.get('endTime') as string;
		const visibility = (formData.get('visibility') as string) || 'public';
		const typeVersionId = (formData.get('typeVersionId') as string) || undefined;

		try {
			const community = await getCommunityBySlug(params.slug, locals.user.id);

			const result = await createProposal(locals.user.id, {
				communityId: community.id,
				title,
				body,
				rationale,
				choices,
				questions,
				startTime: new Date(startTime),
				endTime: new Date(endTime),
				visibility: visibility as 'public' | 'community',
				typeVersionId
			});

			redirect(303, `/proposals/${result.id}`);
		} catch (e) {
			if (e instanceof ServiceError) {
				return fail(e.statusCode, {
					error: e.message,
					title,
					body,
					rationale,
					choices,
					questions,
					startTime,
					endTime,
					visibility,
					typeVersionId
				});
			}
			throw e;
		}
	}
};
