import type { RequestHandler } from './$types';
import { getSitemapEntries } from '$lib/server/services/community-service';

// Static, publicly indexable routes. Auth-only and utility pages
// (login, register, settings, create flows) are deliberately excluded.
const STATIC_PATHS = ['/'];

const xmlEscape = (value: string) =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');

const urlEntry = (loc: string, lastmod?: Date) =>
	`\t<url>\n\t\t<loc>${xmlEscape(loc)}</loc>${
		lastmod ? `\n\t\t<lastmod>${lastmod.toISOString()}</lastmod>` : ''
	}\n\t</url>`;

export const GET: RequestHandler = async ({ url }) => {
	const origin = url.origin;
	const { communities, proposals } = await getSitemapEntries();

	const entries = [
		...STATIC_PATHS.map((path) => urlEntry(`${origin}${path}`)),
		...communities.map((c) => urlEntry(`${origin}/communities/${c.slug}`, c.updatedAt)),
		...proposals.map((p) => urlEntry(`${origin}/proposals/${p.id}`, p.updatedAt))
	];

	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join(
		'\n'
	)}\n</urlset>`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml',
			'Cache-Control': 'max-age=0, s-maxage=3600'
		}
	});
};
