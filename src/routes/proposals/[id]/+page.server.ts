import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getProposal, getProposalResults } from '$lib/server/services/proposal-service';
import { getCommunityById } from '$lib/server/services/community-service';
import { getMember } from '$lib/server/services/membership-service';
import { getUserVote, castVote, getProposalVoters } from '$lib/server/services/vote-service';
import { ServiceError } from '$lib/server/services/errors';

export const load: PageServerLoad = async ({ params, locals }) => {
	const userId = locals.user?.id;

	try {
		const proposal = await getProposal(params.id, userId);
		const [results, community, membership, userVote, voters] = await Promise.all([
			getProposalResults(params.id, userId),
			getCommunityById(proposal.communityId, userId),
			userId ? getMember(proposal.communityId, userId) : Promise.resolve(null),
			userId ? getUserVote(userId, params.id) : Promise.resolve(null),
			getProposalVoters(params.id)
		]);

		return {
			proposal,
			results,
			community,
			membership,
			userVote,
			voters
		};
	} catch (e) {
		if (e instanceof ServiceError) {
			error(e.statusCode, e.message);
		}
		throw e;
	}
};

export const actions: Actions = {
	vote: async ({ request, locals, params }) => {
		if (!locals.user) {
			redirect(302, '/login');
		}

		const formData = await request.formData();
		const choiceId = formData.get('choiceId') as string;

		if (!choiceId) {
			return fail(400, { error: 'Please select a choice before voting' });
		}

		try {
			await castVote(locals.user.id, {
				proposalId: params.id,
				choiceId
			});

			return { success: true };
		} catch (e) {
			if (e instanceof ServiceError) {
				return fail(e.statusCode, { error: e.message });
			}
			throw e;
		}
	}
};
