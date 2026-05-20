import type { RequestHandler } from './$types';
import {
	requireAuth,
	success,
	successNoData,
	handleError,
	parseBody,
	parsePagination
} from '$lib/server/api-utils';
import { requireMember, addMember, listMembers } from '$lib/server/services/membership-service';

/** GET /api/communities/:id/members — list community members. Requires membership. */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	try {
		const user = requireAuth(locals);
		await requireMember(params.id, user.id);
		const pagination = parsePagination(url);
		const result = await listMembers(params.id, pagination);
		return success(result);
	} catch (error) {
		return handleError(error);
	}
};

/** POST /api/communities/:id/members — add a member. Admin required. */
export const POST: RequestHandler = async ({ locals, params, request }) => {
	try {
		const user = requireAuth(locals);
		const body = await parseBody<{ userId: string; role?: 'admin' | 'member' }>(request);
		await addMember(user.id, params.id, body.userId, body.role);
		return successNoData(201);
	} catch (error) {
		return handleError(error);
	}
};
