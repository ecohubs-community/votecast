<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'default' | 'accent';

	// Small inline pill for inline metadata (visibility, role, choice). `variant="accent"` tints it
	// with the accent palette. Any child <svg> is sized to 12px.
	let {
		variant = 'default',
		class: cls = '',
		children,
		...rest
	}: {
		variant?: Variant;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	const BASE =
		'inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] font-body text-[12px] [&_svg]:size-3';
	const VARIANTS: Record<Variant, string> = {
		default: 'bg-bg-2 text-ink-2',
		accent: 'bg-accent-soft text-accent-ink'
	};
</script>

<span class="{BASE} {VARIANTS[variant]} {cls}" {...rest}>{@render children?.()}</span>
