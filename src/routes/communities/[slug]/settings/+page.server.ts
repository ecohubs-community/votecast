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
import { listProposalTypes } from '$lib/server/services/proposal-type-service';
import {
	createProposalType,
	setTypeRetired,
	deleteProposalType,
	listAllProposalTypes,
	getTypeIdsWithProposals,
	methodFromOptionId,
	METHOD_OPTIONS,
	type TypeDefaultsInput
} from '$lib/server/services/proposal-type-admin-service';
import { ServiceError } from '$lib/server/services/errors';
import { db } from '$lib/server/db';
import { webhook } from '$lib/server/db/governance.schema';

/** Parse the type-form defaults/locks from submitted form data (shared by create). */
function parseTypeDefaults(fd: FormData): TypeDefaultsInput {
	const choicesRaw = (fd.get('defaultChoices') as string) ?? '';
	const defaultChoices = choicesRaw
		.split(',')
		.map((c) => c.trim())
		.filter(Boolean);
	return {
		defaultChoices: defaultChoices.length > 0 ? defaultChoices : null,
		votingDays: Number(fd.get('votingDays') ?? 0) || undefined,
		defaultVisibility: (fd.get('defaultVisibility') as 'public' | 'community') || undefined,
		lockChoices: fd.get('lockChoices') === 'on',
		lockDeliberation: fd.get('lockDeliberation') === 'on',
		lockVoting: fd.get('lockVoting') === 'on',
		lockVisibility: fd.get('lockVisibility') === 'on',
		questionContributors: (fd.get('questionContributors') as 'proposer' | 'members') || undefined,
		questionContributionPhase:
			(fd.get('questionContributionPhase') as 'creation' | 'deliberation') || undefined,
		lockQuestionContribution: fd.get('lockQuestionContribution') === 'on'
	};
}

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		redirect(302, '/login');
	}

	try {
		const community = await getCommunityBySlug(params.slug, locals.user.id);
		await requireAdmin(community.id, locals.user.id);

		const [members, webhooks, allTypes, summaries, usedTypeIds] = await Promise.all([
			listMembers(community.id, { limit: 100 }),
			db.select().from(webhook).where(eq(webhook.communityId, community.id)).all(),
			listAllProposalTypes(community.id),
			listProposalTypes(community.id),
			getTypeIdsWithProposals(community.id)
		]);

		const webhookItems = webhooks.map((w) => ({
			id: w.id,
			url: w.url,
			events: JSON.parse(w.events) as string[],
			active: w.active,
			createdAt: w.createdAt
		}));

		const summaryByType = new Map(summaries.map((s) => [s.typeId, s]));
		const usedTypes = new Set(usedTypeIds);
		const types = allTypes.map((t) => ({
			id: t.id,
			name: t.name,
			description: t.description,
			retired: t.retiredAt !== null,
			hasProposals: usedTypes.has(t.id),
			summary: summaryByType.get(t.id) ?? null
		}));

		return {
			community,
			members,
			webhooks: webhookItems,
			types,
			methodOptions: METHOD_OPTIONS
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
	},

	createType: async ({ request, locals, params }) => {
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
				method: methodFromOptionId(optionId, { deliberationDays, tallyReveal }),
				defaults: parseTypeDefaults(fd)
			});
			return { typeSuccess: 'Type created.' };
		} catch (e) {
			if (e instanceof ServiceError) return fail(e.statusCode, { typeError: e.message, name });
			throw e;
		}
	},

	retireType: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const fd = await request.formData();
		const typeId = fd.get('typeId') as string;
		const retired = fd.get('retired') === 'true';
		try {
			await setTypeRetired(locals.user.id, typeId, retired);
			return { typeSuccess: retired ? 'Type retired.' : 'Type restored.' };
		} catch (e) {
			if (e instanceof ServiceError) return fail(e.statusCode, { typeError: e.message });
			throw e;
		}
	},

	deleteType: async ({ request, locals }) => {
		if (!locals.user) redirect(302, '/login');
		const fd = await request.formData();
		const typeId = fd.get('typeId') as string;
		try {
			await deleteProposalType(locals.user.id, typeId);
			return { typeSuccess: 'Type deleted.' };
		} catch (e) {
			if (e instanceof ServiceError) return fail(e.statusCode, { typeError: e.message });
			throw e;
		}
	}
};
