<script lang="ts">
	import type { Snippet } from 'svelte';

	// Muted lede paragraph under a page title.
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

<p
	class="mt-3 mb-0 max-w-[60ch] text-[length:var(--vc-text-md)] leading-[var(--vc-leading-body)] text-ink-2 {cls}"
	{...rest}
>
	{@render children?.()}
</p>
