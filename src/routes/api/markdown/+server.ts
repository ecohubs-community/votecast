import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { renderMarkdown } from '$lib/server/markdown';

/** POST { markdown } → { html } — sanitized preview for the markdown editor. Auth-gated. */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ html: '' }, { status: 401 });
	const { markdown } = (await request.json().catch(() => ({}))) as { markdown?: unknown };
	const html = renderMarkdown(typeof markdown === 'string' ? markdown.slice(0, 20_000) : '');
	return json({ html });
};
