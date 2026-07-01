<script lang="ts">
	import type { Snippet } from 'svelte';

	// Page header row: title/sub on the left, actions on the right.
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

<header
	class="mb-[clamp(24px,3vw,40px)] flex flex-wrap items-end justify-between gap-[var(--vc-space-6)] {cls}"
	{...rest}
>
	{@render children?.()}
</header>
