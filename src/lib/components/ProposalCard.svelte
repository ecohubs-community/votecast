<script lang="ts">
	import StatusBadge from './StatusBadge.svelte';
	import { formatRelativeTime } from '$lib/utils/format';
	import { resolve } from '$app/paths';

	type Props = {
		proposal: {
			id: string;
			title: string;
			status: string;
			startTime: Date;
			endTime: Date;
			body?: string;
		};
		locked?: boolean;
	};

	let { proposal, locked = false }: Props = $props();

	const timeContext = $derived.by(() => {
		if (proposal.status === 'active') {
			return `Ends ${formatRelativeTime(proposal.endTime)}`;
		}
		if (proposal.status === 'closed') {
			return `Ended ${formatRelativeTime(proposal.endTime)}`;
		}
		// draft
		return `Starts ${formatRelativeTime(proposal.startTime)}`;
	});

	const borderColor = $derived.by(() => {
		if (proposal.status === 'active') return 'border-l-blue-500';
		if (proposal.status === 'draft') return 'border-l-yellow-400';
		return 'border-l-gray-300';
	});
</script>

{#snippet cardBody()}
	<div class="flex items-start justify-between gap-2">
		<div class="flex min-w-0 items-center gap-2">
			{#if locked}
				<svg class="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
				</svg>
			{/if}
			<h3 class="truncate text-base font-semibold text-gray-900">{proposal.title}</h3>
		</div>
		<StatusBadge status={proposal.status as 'draft' | 'active' | 'closed'} />
	</div>

	{#if proposal.body}
		<p class="mt-1.5 truncate text-sm text-gray-500">{proposal.body}</p>
	{/if}

	<p class="mt-2 text-xs text-gray-400">{timeContext}</p>
{/snippet}

{#if locked}
	<div
		class="block cursor-not-allowed rounded-lg border border-gray-200 border-l-4 {borderColor} p-4 opacity-60"
		title="You must be a member of this community to see this proposal"
	>
		{@render cardBody()}
	</div>
{:else}
	<a
		href={resolve(`/proposals/${proposal.id}`)}
		class="block rounded-lg border border-gray-200 border-l-4 {borderColor} p-4 transition-shadow hover:shadow-md"
	>
		{@render cardBody()}
	</a>
{/if}
