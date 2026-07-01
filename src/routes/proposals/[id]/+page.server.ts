import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import {
	getProposal,
	getProposalResults,
	getProposalOutcome
} from '$lib/server/services/proposal-service';
import { getCommunityById } from '$lib/server/services/community-service';
import { getMember } from '$lib/server/services/membership-service';
import {
	getUserVote,
	castVote,
	castMultiQuestionVote,
	getProposalVoters
} from '$lib/server/services/vote-service';
import { resolveMethodSummary } from '$lib/server/services/proposal-type-service';
import {
	loadQuestions,
	getUserMultiQuestionAnswers,
	MQ_POSITION_LABELS
} from '$lib/server/services/multi-question';
import { addSubquestion, contributionStatus } from '$lib/server/services/subquestion-service';
import { renderMarkdown } from '$lib/server/markdown';
import { ServiceError } from '$lib/server/services/errors';

export const load: PageServerLoad = async ({ params, locals }) => {
	const userId = locals.user?.id;

	try {
		const proposal = await getProposal(params.id, userId);
		const membership = userId ? await getMember(proposal.communityId, userId) : null;
		const role = membership?.role ?? 'member';

		const [results, outcome, community, userVote, voters, method] = await Promise.all([
			getProposalResults(params.id, userId),
			getProposalOutcome(params.id, userId, undefined, role),
			getCommunityById(proposal.communityId, userId),
			userId ? getUserVote(userId, params.id) : Promise.resolve(null),
			// Secret ballots hide the voter list from non-facilitators — degrade to an empty list for
			// that specific FORBIDDEN only; any other error must surface, not be swallowed.
			getProposalVoters(params.id, undefined, role).catch((e) => {
				if (e instanceof ServiceError && e.statusCode === 403) return [];
				throw e;
			}),
			resolveMethodSummary(proposal)
		]);

		// Common Ground (multi-question): load questions, the viewer's answers, and whether they may add
		// a question right now. Per-question result entries come from the (access-gated) outcome.
		const isMultiQuestion = method.ballotModuleId === 'multi-question';
		const questions = isMultiQuestion ? await loadQuestions(params.id) : [];
		const userAnswers =
			isMultiQuestion && userId ? await getUserMultiQuestionAnswers(userId, params.id) : {};
		const contribution = isMultiQuestion
			? await contributionStatus(userId, params.id)
			: { canAdd: false, note: null };

		return {
			proposal,
			// Server-rendered, sanitized markdown — the body is what's voted on; rationale is the "why".
			bodyHtml: renderMarkdown(proposal.body),
			rationaleHtml: proposal.rationale ? renderMarkdown(proposal.rationale) : null,
			results,
			outcome,
			community,
			membership,
			userVote,
			voters,
			method,
			isMultiQuestion,
			questions,
			userAnswers,
			canAddQuestion: contribution.canAdd,
			questionNote: contribution.note,
			positionLabels: MQ_POSITION_LABELS
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

		// Multi-question ballots submit one `q_<questionId>` field per question.
		const answers = [...formData.entries()]
			.filter(([k, v]) => k.startsWith('q_') && typeof v === 'string' && v)
			.map(([k, v]) => ({ questionId: k.slice(2), choiceId: v as string }));

		try {
			if (answers.length > 0) {
				await castMultiQuestionVote(locals.user.id, { proposalId: params.id, answers });
				return { success: true };
			}

			const choiceId = formData.get('choiceId') as string;
			if (!choiceId) {
				return fail(400, { error: 'Please select a choice before voting' });
			}
			await castVote(locals.user.id, { proposalId: params.id, choiceId });
			return { success: true };
		} catch (e) {
			if (e instanceof ServiceError) {
				return fail(e.statusCode, { error: e.message });
			}
			throw e;
		}
	},

	addQuestion: async ({ request, locals, params }) => {
		if (!locals.user) {
			redirect(302, '/login');
		}
		const formData = await request.formData();
		const prompt = formData.get('prompt') as string;
		try {
			await addSubquestion(locals.user.id, params.id, prompt);
			return { questionAdded: true };
		} catch (e) {
			if (e instanceof ServiceError) {
				return fail(e.statusCode, { questionError: e.message });
			}
			throw e;
		}
	}
};
