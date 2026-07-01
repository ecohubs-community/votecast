<script lang="ts">
	import type { Snippet } from 'svelte';

	// Back-link with a leading ← arrow. `href` is supplied already-resolved by the caller.
	let {
		href,
		class: cls = '',
		children,
		...rest
	}: {
		href: string;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	const cx =
		"mb-5 inline-flex items-center gap-1.5 font-mono text-[length:var(--vc-text-xs)] tracking-[var(--vc-tracking-mono)] text-muted uppercase no-underline transition-colors duration-[var(--vc-duration-fast)] ease-[var(--vc-ease)] before:font-body before:text-[14px] before:tracking-normal before:content-['←'] hover:text-ink";
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href is supplied already-resolved by the caller -->
<a {href} class="{cx} {cls}" {...rest}>{@render children?.()}</a>
