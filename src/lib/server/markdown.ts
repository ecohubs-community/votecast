import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

// Single server-side markdown → safe HTML path (design D1). Proposals are user content shown to
// others, so the output is ALWAYS sanitized here; `{@html}` is only ever given output of this function.

marked.setOptions({ gfm: true, breaks: true });

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: [
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'p',
		'br',
		'hr',
		'strong',
		'em',
		'del',
		'code',
		'pre',
		'blockquote',
		'ul',
		'ol',
		'li',
		'a',
		'img',
		'table',
		'thead',
		'tbody',
		'tr',
		'th',
		'td'
	],
	allowedAttributes: {
		a: ['href', 'title', 'rel', 'target'],
		img: ['src', 'alt', 'title'],
		th: ['align'],
		td: ['align']
	},
	// Only safe URL schemes (blocks javascript:, data: scripts, etc.).
	allowedSchemes: ['http', 'https', 'mailto'],
	allowedSchemesByTag: { img: ['http', 'https'] },
	transformTags: {
		// Harden external links.
		a: sanitizeHtml.simpleTransform('a', { rel: 'noopener nofollow ugc', target: '_blank' })
	}
};

/** Render markdown to sanitized HTML. The only place that produces HTML for `{@html}`. */
export function renderMarkdown(markdown: string | null | undefined): string {
	if (!markdown) return '';
	const rawHtml = marked.parse(markdown, { async: false }) as string;
	return sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
}
