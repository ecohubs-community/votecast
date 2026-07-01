<script lang="ts">
	import Button from '$lib/components/Button.svelte';

	type Props = {
		message: string;
		actionText?: string;
		/** Caller-supplied, already-resolved href (e.g. via `resolve(...)`). */
		actionHref?: string;
	};

	let { message, actionText, actionHref }: Props = $props();
</script>

<div class="empty">
	<p>{message}</p>

	{#if actionText && actionHref}
		<Button href={actionHref} variant="ghost" size="sm">{actionText}</Button>
	{/if}
</div>
