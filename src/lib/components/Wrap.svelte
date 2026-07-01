<script lang="ts">
	import type { Snippet } from 'svelte';

	// Horizontal container: caps content at the shared container width and pads the gutters. The
	// container width is owned here (mirrors `Page`), so full-bleed sections stay aligned.
	let {
		class: cls = '',
		children,
		...rest
	}: {
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();
</script>

<div class="mx-auto max-w-[var(--vc-container)] px-[var(--vc-pad-x)] {cls}" {...rest}>
	{@render children?.()}
</div>
