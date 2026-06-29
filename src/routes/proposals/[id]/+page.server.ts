import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	getProposal,
	getProposalResults,
	getProposalOutcome
} from '$lib/server/services/proposal-service';
import { getCommunityById } from '$lib/server/services/community-service';
import { getMember } from '$lib/server/services/membership-service';
import { getUserVote, castVote, getProposalVoters } from '$lib/server/services/vote-service';
import { ServiceError } from '$lib/server/services/errors';

export const load: PageServerLoad = async ({ params, locals }) => {
	const userId = locals.user?.id;

	try {
		const proposal = await getProposal(params.id, userId);
		const membership = userId ? await getMember(proposal.communityId, userId) : null;
		const role = membership?.role ?? 'member';

		const [results, outcome, community, userVote, voters] = await Promise.all([
			getProposalResults(params.id, userId),
			getProposalOutcome(params.id, userId, undefined, role),
			getCommunityById(proposal.communityId, userId),
			userId ? getUserVote(userId, params.id) : Promise.resolve(null),
			// Secret ballots hide the voter list from non-facilitators — degrade to an empty list.
			getProposalVoters(params.id, undefined, role).catch(() => [])
		]);

		return {
			proposal,
			results,
			outcome,
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
