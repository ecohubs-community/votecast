<script lang="ts">
	import type { Snippet } from 'svelte';

	// Surface card used across the app (voting panel, invite form, settings sections, …).
	// Pass `title` to render the header row; `actions` fills its right side. Set `padded={false}`
	// when a caller needs its own padding (avoids a shorthand/longhand conflict).
	let {
		as = 'div',
		title = undefined,
		titleAs = 'h2',
		padded = true,
		actions,
		class: cls = '',
		children,
		...rest
	}: {
		as?: string;
		title?: string;
		titleAs?: 'h2' | 'h3';
		padded?: boolean;
		actions?: Snippet;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	const BASE =
		'rounded-[var(--vc-radius-xl)] border border-line bg-surface shadow-[var(--vc-shadow-xs)]';
	const cx = $derived(`${BASE} ${padded ? 'p-6' : ''} ${cls}`);
</script>

<svelte:element this={as} class={cx} {...rest}>
	{#if title}
		<div class="mb-[18px] flex items-baseline justify-between gap-3">
			<svelte:element
				this={titleAs}
				class="m-0 font-display text-[length:var(--vc-text-xl)] leading-[1.2] font-normal tracking-[-0.01em] text-ink"
			>
				{title}
			</svelte:element>
			{@render actions?.()}
		</div>
	{/if}
	{@render children?.()}
</svelte:element>
