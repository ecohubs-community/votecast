<script lang="ts">
	import type { Snippet } from 'svelte';

	// One ballot/result option row — the styling lives here so the three render paths on the proposal
	// detail (voting, already-voted, read-only results) never repeat the utility classes.
	let {
		label,
		pct = 0,
		detail = null,
		showFill = false,
		highlighted = false,
		interactive = false,
		marker = 'radio',
		children
	}: {
		label: string;
		pct?: number;
		detail?: string | null;
		showFill?: boolean;
		highlighted?: boolean;
		interactive?: boolean;
		marker?: 'radio' | 'check';
		children?: Snippet;
	} = $props();
</script>

<svelte:element
	this={interactive ? 'label' : 'div'}
	class="relative flex w-full items-center gap-3.5 overflow-hidden rounded-[var(--vc-radius-lg)] border bg-bg px-4 py-3.5 text-left text-inherit transition-[border-color,background] duration-[var(--vc-duration-base)] ease-[var(--vc-ease)] {interactive
		? 'cursor-pointer'
		: 'cursor-default'} {highlighted
		? 'border-accent bg-accent-soft'
		: interactive
			? 'border-line hover:border-line-2'
			: 'border-line'}"
>
	{#if showFill}
		<div
			class="absolute inset-0 transition-[width] duration-[var(--vc-duration-slow)] ease-[var(--vc-ease-out)] {highlighted
				? 'bg-[color-mix(in_oklab,var(--vc-accent)_16%,transparent)]'
				: 'bg-bg-2'}"
			style="width: {pct}%"
		></div>
	{/if}
	<div class="relative flex w-full items-center gap-3.5">
		{@render children?.()}
		{#if marker === 'check'}
			<svg
				width="18"
				height="18"
				viewBox="0 0 20 20"
				fill="currentColor"
				class="shrink-0 text-accent"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
					clip-rule="evenodd"
				/>
			</svg>
		{:else}
			<span
				class="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-[border-color] duration-[var(--vc-duration-base)] ease-[var(--vc-ease)] {highlighted
					? 'border-accent'
					: 'border-line-2'}"
			>
				{#if highlighted}
					<span class="size-2 rounded-full bg-accent"></span>
				{/if}
			</span>
		{/if}
		<span class="min-w-0 flex-1 text-[15px] font-medium text-ink">{label}</span>
		{#if detail}
			<span
				class="ml-auto shrink-0 font-mono text-[12px] {highlighted && !interactive
					? 'text-accent-ink'
					: 'text-muted'}"
			>
				{detail}
			</span>
		{/if}
	</div>
</svelte:element>
