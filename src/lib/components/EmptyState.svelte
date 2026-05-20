<script lang="ts">
	type Props = {
		icon?: 'proposals' | 'communities' | 'votes';
		message: string;
		actionText?: string;
		actionHref?: string;
	};

	let { message, actionText, actionHref }: Props = $props();
</script>

<div class="empty">
	<p>{message}</p>

	{#if actionText && actionHref}
		<a href={actionHref} class="btn btn-ghost btn-sm">{actionText}</a>
	{/if}
</div>
