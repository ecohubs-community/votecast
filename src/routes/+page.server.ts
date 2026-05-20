import type { PageServerLoad } from './$types';
import { getPublicCommunities, getUserCommunities } from '$lib/server/services/community-service';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user?.id;

	const [newest, mostActive] = await Promise.all([
		getPublicCommunities('newest', 6),
		getPublicCommunities('most_active', 6)
	]);

	const myCommunities = userId ? await getUserCommunities(userId, { limit: 6 }) : null;

	return {
		newest,
		mostActive,
		myCommunities
	};
};
