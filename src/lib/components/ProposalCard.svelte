<script lang="ts">
	import StatusBadge from './StatusBadge.svelte';
	import { formatRelativeTime } from '$lib/utils/format';
	import { PHASE_VARIANT, type ProposalPhase } from '$lib/utils/phase';
	import { resolve } from '$app/paths';

	type Props = {
		proposal: {
			id: string;
			title: string;
			phase: ProposalPhase;
			startTime: Date;
			endTime: Date;
			body?: string;
			visibility?: 'public' | 'community';
		};
		locked?: boolean;
	};

	let { proposal, locked = false }: Props = $props();

	const timeContext = $derived.by(() => {
		if (proposal.phase === 'voting') return `Closes ${formatRelativeTime(proposal.endTime)}`;
		if (proposal.phase === 'finalized') return `Closed ${formatRelativeTime(proposal.endTime)}`;
		if (proposal.phase === 'objection-window')
			return `Objection window — closed ${formatRelativeTime(proposal.endTime)}`;
		return `Opens ${formatRelativeTime(proposal.startTime)}`;
	});

	const statusClass = $derived(`status-${PHASE_VARIANT[proposal.phase]}`);
</script>

{#snippet cardBody()}
	<div class="proposal-row-head">
		<h3 class="proposal-row-title">
			{#if locked}
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					style="color: var(--vc-muted); flex-shrink: 0;"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
					/>
				</svg>
			{/if}
			<span style="overflow: hidden; text-overflow: ellipsis;">{proposal.title}</span>
		</h3>
		<div class="proposal-row-meta">
			{#if proposal.visibility === 'public'}
				<span class="meta-pill" title="Public">
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="9" />
						<path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
					</svg>
					Public
				</span>
			{:else if proposal.visibility === 'community' && !locked}
				<span class="meta-pill" title="Members only">
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						aria-hidden="true"
					>
						<rect x="4" y="11" width="16" height="10" rx="2" />
						<path d="M8 11V7a4 4 0 0 1 8 0v4" />
					</svg>
					Internal
				</span>
			{/if}
			<StatusBadge phase={proposal.phase} />
		</div>
	</div>

	{#if proposal.body}
		<p class="proposal-row-body">{proposal.body}</p>
	{/if}

	<p class="proposal-row-time">{timeContext}</p>
{/snippet}

{#if locked}
	<div
		class="proposal-row locked {statusClass}"
		title="You must be a member of this community to open this proposal"
	>
		{@render cardBody()}
	</div>
{:else}
	<a href={resolve(`/proposals/${proposal.id}`)} class="proposal-row {statusClass}">
		{@render cardBody()}
	</a>
{/if}
