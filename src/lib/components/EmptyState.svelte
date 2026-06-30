<script lang="ts">
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
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- actionHref is supplied already-resolved by the caller -->
		<a href={actionHref} class="btn btn-ghost btn-sm">{actionText}</a>
	{/if}
</div>
