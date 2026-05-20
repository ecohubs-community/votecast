import type { RequestHandler } from './$types';
import {
	requireAuth,
	success,
	handleError,
	parseBody,
	parsePagination
} from '$lib/server/api-utils';
import {
	createCommunity,
	getUserCommunities,
	type CreateCommunityInput
} from '$lib/server/services/community-service';

/** POST /api/communities — create a new community. */
export const POST: RequestHandler = async ({ locals, request }) => {
	try {
		const user = requireAuth(locals);
		const body = await parseBody<CreateCommunityInput>(request);
		const result = await createCommunity(user.id, body);
		return success(result, 201);
	} catch (error) {
		return handleError(error);
	}
};

/** GET /api/communities — list communities the authenticated user belongs to. */
export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		const user = requireAuth(locals);
		const pagination = parsePagination(url);
		const result = await getUserCommunities(user.id, pagination);
		return success(result);
	} catch (error) {
		return handleError(error);
	}
};
