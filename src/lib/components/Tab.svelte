<script lang="ts">
	import type { Snippet } from 'svelte';

	// A single tab button. `active` draws the accent underline; `danger` tints it red (for a
	// destructive section). `onclick` and any other attributes pass straight through.
	let {
		active = false,
		danger = false,
		class: cls = '',
		children,
		...rest
	}: {
		active?: boolean;
		danger?: boolean;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	const BASE =
		'-mb-px cursor-pointer border-b-2 border-transparent bg-transparent px-4 py-3 text-[14px] font-medium whitespace-nowrap transition-[color,border-color] duration-[var(--vc-duration-fast)] ease-[var(--vc-ease)]';
	const state = $derived(
		danger
			? `text-[oklch(0.5_0.14_28)] ${active ? 'border-b-accent' : ''}`
			: active
				? 'border-b-accent text-ink'
				: 'text-muted hover:text-ink-2'
	);
	const cx = $derived(`${BASE} ${state} ${cls}`);
</script>

<button type="button" class={cx} {...rest}>{@render children?.()}</button>
