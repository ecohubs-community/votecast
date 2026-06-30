<script lang="ts">
	// Renders already-sanitized HTML (produced server-side by renderMarkdown). The `html` prop MUST be
	// the output of $lib/server/markdown — never raw user input.
	let { html }: { html: string } = $props();
</script>

{#if html}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	<div class="markdown-body">{@html html}</div>
{/if}

<style>
	.markdown-body {
		line-height: 1.6;
		color: var(--vc-ink);
		overflow-wrap: anywhere;
	}
	/* Markdown headings are demoted one level server-side (# → h2), so the real page <h1> stays
	   unique. Size them distinctly, all smaller than the page title. */
	.markdown-body :global(h2),
	.markdown-body :global(h3),
	.markdown-body :global(h4),
	.markdown-body :global(h5),
	.markdown-body :global(h6) {
		font-family: var(--vc-font-display, inherit);
		font-weight: 600;
		margin: 1.2em 0 0.5em;
		line-height: 1.25;
	}
	.markdown-body :global(h2) {
		font-size: 1.4em;
	}
	.markdown-body :global(h3) {
		font-size: 1.2em;
	}
	.markdown-body :global(h4) {
		font-size: 1.05em;
	}
	.markdown-body :global(h5) {
		font-size: 0.95em;
	}
	.markdown-body :global(h6) {
		font-size: 0.85em;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--vc-muted);
	}
	.markdown-body :global(p) {
		margin: 0 0 0.9em;
	}
	.markdown-body :global(a) {
		color: var(--vc-accent);
		text-decoration: underline;
	}
	.markdown-body :global(ul),
	.markdown-body :global(ol) {
		margin: 0 0 0.9em;
		padding-left: 1.4em;
	}
	.markdown-body :global(blockquote) {
		margin: 0 0 0.9em;
		padding-left: 1em;
		border-left: 3px solid var(--vc-line);
		color: var(--vc-ink-2);
	}
	.markdown-body :global(code) {
		font-family: var(--vc-font-mono, monospace);
		font-size: 0.92em;
		background: var(--vc-surface-2, rgba(0, 0, 0, 0.05));
		padding: 0.1em 0.35em;
		border-radius: 4px;
	}
	.markdown-body :global(pre) {
		overflow-x: auto;
		padding: 12px;
		background: var(--vc-surface-2, rgba(0, 0, 0, 0.05));
		border-radius: 8px;
	}
	.markdown-body :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: 8px;
	}
	.markdown-body :global(table) {
		border-collapse: collapse;
		margin: 0 0 0.9em;
	}
	.markdown-body :global(th),
	.markdown-body :global(td) {
		border: 1px solid var(--vc-line);
		padding: 6px 10px;
	}
	.markdown-body :global(hr) {
		border: none;
		border-top: 1px solid var(--vc-line);
		margin: 1.4em 0;
	}
</style>
