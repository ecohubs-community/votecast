<script lang="ts">
	import type { Snippet } from 'svelte';

	// Centered page container. `narrow` switches to the 560px auth-form width.
	let {
		narrow = false,
		class: cls = '',
		children,
		...rest
	}: {
		narrow?: boolean;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	const width = $derived(
		narrow
			? 'max-w-[560px] pt-[clamp(48px,7vw,96px)]'
			: 'max-w-[var(--vc-container)] pt-[clamp(32px,5vw,56px)]'
	);
</script>

<div class="{width} mx-auto px-[var(--vc-pad-x)] pb-[clamp(40px,6vw,80px)] {cls}" {...rest}>
	{@render children?.()}
</div>
