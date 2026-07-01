<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from '$lib/components/Button.svelte';

	type Props = {
		message: string;
		actionText?: string;
		/** Caller-supplied, already-resolved href (e.g. via `resolve(...)`). */
		actionHref?: string;
		/** Extra classes on the wrapper (e.g. spacing). */
		class?: string;
		/** Custom footer content, used instead of actionText/actionHref. */
		children?: Snippet;
	};

	let { message, actionText, actionHref, class: cls = '', children }: Props = $props();
</script>

<div
	class="rounded-[var(--vc-radius-xl)] border border-dashed border-line-2 bg-[color-mix(in_oklab,var(--vc-bg)_60%,transparent)] p-10 text-center text-muted {cls}"
>
	<p class="m-0 mb-3.5">{message}</p>

	{#if actionText && actionHref}
		<Button href={actionHref} variant="ghost" size="sm">{actionText}</Button>
	{/if}
	{@render children?.()}
</div>
