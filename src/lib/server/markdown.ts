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
		a: sanitizeHtml.simpleTransform('a', { rel: 'noopener nofollow ugc', target: '_blank' }),
		// Demote every markdown heading one level so a proposal's `#` never emits a second page <h1>
		// (the proposal title is the real <h1>). transformTags maps each source tag once — no cascade.
		h1: sanitizeHtml.simpleTransform('h2', {}),
		h2: sanitizeHtml.simpleTransform('h3', {}),
		h3: sanitizeHtml.simpleTransform('h4', {}),
		h4: sanitizeHtml.simpleTransform('h5', {}),
		h5: sanitizeHtml.simpleTransform('h6', {})
	}
};

/** Render markdown to sanitized HTML. The only place that produces HTML for `{@html}`. */
export function renderMarkdown(markdown: string | null | undefined): string {
	if (!markdown) return '';
	const rawHtml = marked.parse(markdown, { async: false }) as string;
	return sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
}
