import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getCommunityBySlug } from '$lib/server/services/community-service';
import { listProposals, type ProposalFilters } from '$lib/server/services/proposal-service';
import { getMember, createInvite, listMembers } from '$lib/server/services/membership-service';
import { ServiceError } from '$lib/server/services/errors';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const userId = locals.user?.id;

	try {
		const community = await getCommunityBySlug(params.slug, userId);

		// Parse optional filters
		const statusParam = url.searchParams.get('status');
		const filters: ProposalFilters = {};
		if (statusParam === 'draft' || statusParam === 'active' || statusParam === 'closed') {
			filters.status = statusParam;
		}

		const cursor = url.searchParams.get('cursor') ?? undefined;

		const [proposals, membership] = await Promise.all([
			listProposals(community.id, filters, { limit: 20, cursor }),
			userId ? getMember(community.id, userId) : Promise.resolve(null)
		]);

		// Only load members list for community members (access control)
		const members = membership
			? await listMembers(community.id, { limit: 50 })
			: null;

		return {
			community,
			proposals,
			membership,
			members,
			statusFilter: filters.status ?? null
		};
	} catch (e) {
		if (e instanceof ServiceError) {
			error(e.statusCode, e.message);
		}
		throw e;
	}
};

export const actions: Actions = {
	invite: async ({ request, locals, params, url }) => {
		if (!locals.user) {
			redirect(302, '/login');
		}

		const formData = await request.formData();
		const maxUsesStr = formData.get('maxUses') as string;
		const expiresAt = formData.get('expiresAt') as string;

		if (!expiresAt) {
			return fail(400, { inviteError: 'Expiration date is required' });
		}

		try {
			const community = await getCommunityBySlug(params.slug, locals.user.id);

			const invite = await createInvite(locals.user.id, community.id, {
				maxUses: maxUsesStr ? parseInt(maxUsesStr, 10) || undefined : undefined,
				expiresAt
			});

			const inviteUrl = `${url.origin}/join/${invite.token}`;
			return { inviteUrl };
		} catch (e) {
			if (e instanceof ServiceError) {
				return fail(e.statusCode, { inviteError: e.message });
			}
			throw e;
		}
	}
};
