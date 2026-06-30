<script lang="ts">
	import { untrack } from 'svelte';
	import Markdown from './Markdown.svelte';

	interface Props {
		name: string;
		value?: string;
		rows?: number;
		placeholder?: string;
		required?: boolean;
	}
	let { name, value = '', rows = 10, placeholder = '', required = false }: Props = $props();

	// Seed the editable copy from the initial prop once; later prop changes must not clobber edits.
	let text = $state(untrack(() => value));
	let textarea = $state<HTMLTextAreaElement>();
	let previewing = $state(false);
	let previewHtml = $state('');
	let previewLoading = $state(false);

	/** Wrap the current selection (or insert a placeholder) with markdown tokens. */
	function surround(before: string, after: string, placeholderText = '') {
		const el = textarea;
		if (!el) return;
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const selected = text.slice(start, end) || placeholderText;
		text = text.slice(0, start) + before + selected + after + text.slice(end);
		const caret = start + before.length + selected.length;
		queueMicrotask(() => {
			el.focus();
			el.setSelectionRange(start + before.length, caret);
		});
	}

	function insert(snippet: string) {
		const el = textarea;
		if (!el) return;
		const start = el.selectionStart;
		text = text.slice(0, start) + snippet + text.slice(el.selectionEnd);
		queueMicrotask(() => {
			el.focus();
			el.setSelectionRange(start + snippet.length, start + snippet.length);
		});
	}

	const actions = [
		{ label: 'H', title: 'Heading', run: () => insert('\n## ') },
		{ label: 'B', title: 'Bold', run: () => surround('**', '**', 'bold') },
		{ label: 'I', title: 'Italic', run: () => surround('*', '*', 'italic') },
		{ label: 'Link', title: 'Link', run: () => surround('[', '](https://)', 'text') },
		{
			label: 'Table',
			title: 'Table',
			run: () => insert('\n\n| Col | Col |\n| --- | --- |\n|  |  |\n')
		},
		{ label: 'Img', title: 'Image', run: () => insert('![alt](https://)') },
		{ label: 'HR', title: 'Divider', run: () => insert('\n\n---\n\n') }
	];

	async function togglePreview() {
		previewing = !previewing;
		if (previewing) {
			previewLoading = true;
			try {
				const res = await fetch('/api/markdown', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ markdown: text })
				});
				previewHtml = res.ok ? ((await res.json()).html ?? '') : '';
			} catch {
				previewHtml = '';
			} finally {
				previewLoading = false;
			}
		}
	}
</script>

<div class="md-editor">
	<div class="md-toolbar">
		{#each actions as a (a.title)}
			<button type="button" class="md-btn" title={a.title} onclick={a.run} disabled={previewing}>
				{a.label}
			</button>
		{/each}
		<button
			type="button"
			class="md-btn md-preview-toggle"
			class:on={previewing}
			onclick={togglePreview}
		>
			{previewing ? 'Edit' : 'Preview'}
		</button>
	</div>

	{#if previewing}
		<div class="md-preview">
			{#if previewLoading}
				<p class="hint">Rendering…</p>
			{:else}
				<Markdown html={previewHtml} />
			{/if}
		</div>
	{:else}
		<textarea
			bind:this={textarea}
			bind:value={text}
			{name}
			{rows}
			{placeholder}
			{required}
			class="textarea"
		></textarea>
	{/if}
	<!-- Always submit the raw markdown even while previewing. -->
	{#if previewing}
		<input type="hidden" {name} value={text} />
	{/if}
</div>

<style>
	.md-toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 6px;
	}
	.md-btn {
		font: inherit;
		font-size: 13px;
		padding: 4px 10px;
		border: 1px solid var(--vc-line);
		border-radius: 6px;
		background: var(--vc-surface);
		color: var(--vc-ink-2);
		cursor: pointer;
	}
	.md-btn:hover:not(:disabled) {
		border-color: var(--vc-line-2);
		color: var(--vc-ink);
	}
	.md-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.md-preview-toggle {
		margin-left: auto;
	}
	.md-preview-toggle.on {
		border-color: var(--vc-accent);
		color: var(--vc-accent-ink, var(--vc-accent));
	}
	.md-preview {
		min-height: 120px;
		padding: 11px 14px;
		border: 1px solid var(--vc-line);
		border-radius: var(--vc-radius-md);
		background: var(--vc-surface);
	}
</style>
