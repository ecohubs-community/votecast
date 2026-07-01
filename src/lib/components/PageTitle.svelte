<script lang="ts">
	import type { Snippet } from 'svelte';

	// Inner-page H1. Wrap emphasised words in <em> for the accent-ink italic treatment.
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

<h1
	class="m-0 font-display text-[length:var(--vc-text-3xl)] leading-[var(--vc-leading-tight)] font-normal tracking-[var(--vc-tracking-tight)] text-balance text-ink [&_em]:font-normal [&_em]:text-accent-ink [&_em]:italic {cls}"
	{...rest}
>
	{@render children?.()}
</h1>
