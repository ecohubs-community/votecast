<script lang="ts">
	import type { Snippet } from 'svelte';

	// Horizontal tab bar (the underline strip). Wraps a row of <Tab> buttons.
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

<nav class="mb-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line {cls}" {...rest}>
	{@render children?.()}
</nav>
