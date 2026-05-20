import type { RequestHandler } from './$types';
import { success, handleError, parsePagination } from '$lib/server/api-utils';
import { listProposals } from '$lib/server/services/proposal-service';

/** GET /api/communities/:id/proposals — list proposals for a community. */
export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const status = url.searchParams.get('status') as 'draft' | 'active' | 'closed' | null;
		const pagination = parsePagination(url);
		const filters = status ? { status } : undefined;
		const result = await listProposals(params.id, filters, pagination);
		return success(result);
	} catch (error) {
		return handleError(error);
	}
};
