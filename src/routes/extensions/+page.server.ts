import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listBallotModules, listDecisionRules } from '$lib/server/voting';
import { describeRegisteredPlugins } from '$lib/server/plugins';

/** Read-only "Extensions" surface: the two registries — method modules and event plugins (task 7.5). */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');

	return {
		ballotModules: listBallotModules(),
		decisionRules: listDecisionRules(),
		plugins: describeRegisteredPlugins()
	};
};
