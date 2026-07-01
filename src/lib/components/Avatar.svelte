<script lang="ts">
	import type { Snippet } from 'svelte';

	// Round initials bubble. Renders a <span> by default; pass `as="button"` (with onclick/aria) for
	// the interactive menu trigger.
	let {
		as = 'span',
		class: cls = '',
		children,
		...rest
	}: {
		as?: string;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	const BASE =
		'inline-flex size-9 cursor-pointer items-center justify-center rounded-full border-0 bg-ink font-body text-[12px] font-medium tracking-[0.04em] text-bg transition-[box-shadow] duration-[var(--vc-duration-fast)] ease-[var(--vc-ease)] hover:shadow-[0_0_0_3px_var(--vc-bg-2)]';
</script>

<svelte:element this={as} class="{BASE} {cls}" {...rest}>{@render children?.()}</svelte:element>
