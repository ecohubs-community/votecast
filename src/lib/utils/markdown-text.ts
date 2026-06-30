// Best-effort markdown → single-line plain text, for list excerpts where we want readable text rather
// than rendered markup (no HTML, no formatting tokens, no table pipes).
export function markdownToPlainText(markdown: string | null | undefined): string {
	if (!markdown) return '';
	return (
		markdown
			// fenced code blocks
			.replace(/```[\s\S]*?```/g, ' ')
			// images ![alt](url) → alt
			.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
			// links [text](url) → text
			.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
			// inline code `code` → code
			.replace(/`([^`]+)`/g, '$1')
			// table separator rows: | --- | :--- |
			.replace(/^\s*\|?\s*:?-{2,}.*$/gm, ' ')
			// horizontal rules
			.replace(/^\s*([-*_])\1{2,}\s*$/gm, ' ')
			// leading block markers: headings, blockquotes, list bullets/numbers
			.replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
			// table cell pipes → space
			.replace(/\|/g, ' ')
			// emphasis / bold / strikethrough markers
			.replace(/(\*\*|__|\*|_|~~)/g, '')
			// collapse all whitespace
			.replace(/\s+/g, ' ')
			.trim()
	);
}
