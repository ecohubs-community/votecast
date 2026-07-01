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

	const btnClass =
		'cursor-pointer rounded-md border border-line bg-surface px-2.5 py-1 text-[13px] text-ink-2 enabled:hover:border-line-2 enabled:hover:text-ink disabled:cursor-default disabled:opacity-50';

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

<div>
	<div class="mb-1.5 flex flex-wrap gap-1">
		{#each actions as a (a.title)}
			<button type="button" class={btnClass} title={a.title} onclick={a.run} disabled={previewing}>
				{a.label}
			</button>
		{/each}
		<button
			type="button"
			class="{btnClass} ml-auto {previewing ? 'border-accent text-accent-ink' : ''}"
			onclick={togglePreview}
		>
			{previewing ? 'Edit' : 'Preview'}
		</button>
	</div>

	{#if previewing}
		<div
			class="min-h-[120px] rounded-[var(--vc-radius-md)] border border-line bg-surface px-3.5 py-[11px]"
		>
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
