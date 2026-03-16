<script lang="ts">
	import { enhance } from '$app/forms';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { formatRelativeTime } from '$lib/utils/format';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedChoiceId = $state<string | null>(null);
	let submitting = $state(false);
	let activeTab = $state<'description' | 'voters'>('description');

	const timeContext = $derived.by(() => {
		if (data.proposal.status === 'active') {
			return `Voting ends ${formatRelativeTime(data.proposal.endTime)}`;
		}
		if (data.proposal.status === 'closed') {
			return `Voting ended ${formatRelativeTime(data.proposal.endTime)}`;
		}
		return `Voting starts ${formatRelativeTime(data.proposal.startTime)}`;
	});

	const votingState = $derived.by(() => {
		if (data.proposal.status !== 'active') return 'read-only' as const;
		if (!data.user) return 'not-logged-in' as const;
		if (!data.membership) return 'not-member' as const;
		if (data.userVote) return 'already-voted' as const;
		return 'can-vote' as const;
	});

	// Map results by choiceId for quick lookup
	const resultsByChoice = $derived.by(() => {
		const map = new Map<string, { votes: number; pct: number }>();
		for (const r of data.results.results) {
			const pct =
				data.results.totalVotes > 0
					? Math.round((r.votes / data.results.totalVotes) * 100)
					: 0;
			map.set(r.choiceId, { votes: r.votes, pct });
		}
		return map;
	});

	const showResults = $derived(
		data.proposal.status === 'active' || data.proposal.status === 'closed'
	);
</script>

<svelte:head>
	<title>{data.proposal.title} — LumiVote</title>
</svelte:head>

<!-- Breadcrumb -->
<div class="mb-6">
	<a href="/communities/{data.community.slug}" class="text-sm text-blue-600 hover:text-blue-800">
		&larr; Back to {data.community.name}
	</a>
</div>

<!-- Header -->
<section class="border-b border-gray-200 pb-6">
	<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
		<div>
			<h1 class="text-2xl font-bold text-gray-900 sm:text-3xl">{data.proposal.title}</h1>
			<div class="mt-2 flex items-center gap-3">
				<StatusBadge status={data.proposal.status as 'draft' | 'active' | 'closed'} />
				<span class="text-sm text-gray-500">{timeContext}</span>
			</div>
		</div>

		{#if data.proposal.status === 'draft' && (data.proposal.createdBy === data.user?.id || data.membership?.role === 'admin')}
			<span class="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-500">
				Edit (coming soon)
			</span>
		{/if}
	</div>
</section>

<!-- Two-column layout -->
<div class="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
	<!-- Left column: tabs (Description / Voters) -->
	<div class="lg:col-span-2">
		<!-- Tab switcher -->
		<div class="flex gap-1 border-b border-gray-200">
			<button
				onclick={() => (activeTab = 'description')}
				class="px-4 py-2.5 text-sm font-medium transition-colors {activeTab === 'description'
					? 'border-b-2 border-blue-600 text-blue-600'
					: 'text-gray-500 hover:text-gray-700'}"
			>
				Description
			</button>
			<button
				onclick={() => (activeTab = 'voters')}
				class="px-4 py-2.5 text-sm font-medium transition-colors {activeTab === 'voters'
					? 'border-b-2 border-blue-600 text-blue-600'
					: 'text-gray-500 hover:text-gray-700'}"
			>
				Voters ({data.results.totalVotes})
			</button>
		</div>

		<!-- Tab content -->
		{#if activeTab === 'description'}
			<div class="mt-4 whitespace-pre-wrap text-gray-700">{data.proposal.body}</div>
		{:else}
			<!-- Voters list -->
			{#if data.voters.length === 0}
				<p class="py-10 text-center text-sm text-gray-500">No votes yet.</p>
			{:else}
				<div class="mt-4 divide-y divide-gray-100">
					{#each data.voters as voter}
						<div class="flex items-center justify-between py-3 text-sm">
							<span class="font-medium text-gray-900">
								{voter.displayName || voter.name}
							</span>
							<div class="flex items-center gap-4">
								<span
									class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600"
								>
									{voter.choiceLabel}
								</span>
								<span class="w-24 text-right text-xs text-gray-400">
									{formatRelativeTime(voter.votedAt)}
								</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>

	<!-- Right column: Voting + Results merged -->
	<div>
		<div class="rounded-lg border border-gray-200 p-5">
			<h2 class="text-base font-semibold text-gray-900">
				{votingState === 'can-vote' ? 'Cast your vote' : 'Vote'}
				{#if showResults}
					<span class="ml-1.5 text-sm font-normal text-gray-500">
						· {data.results.totalVotes}
						{data.results.totalVotes === 1 ? 'vote' : 'votes'}
					</span>
				{/if}
			</h2>

			{#if form?.error}
				<div
					class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
				>
					{form.error}
				</div>
			{/if}

			{#if form?.success}
				<div
					class="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
				>
					Your vote has been recorded.
				</div>
			{/if}

			{#if votingState === 'can-vote'}
				<!-- Interactive voting with progress bars -->
				<form
					method="POST"
					action="?/vote"
					use:enhance={() => {
						submitting = true;
						return async ({ update }) => {
							submitting = false;
							await update();
						};
					}}
				>
					<fieldset disabled={submitting} class="mt-4 space-y-2">
						{#each data.proposal.choices as choice}
							{@const result = resultsByChoice.get(choice.id)}
							{@const pct = result?.pct ?? 0}
							{@const votes = result?.votes ?? 0}
							{@const isSelected = selectedChoiceId === choice.id}
							<label
								class="relative flex cursor-pointer items-center overflow-hidden rounded-lg border px-4 py-3 transition-colors
									{isSelected
									? 'border-blue-500 ring-1 ring-blue-500'
									: 'border-gray-200 hover:border-gray-300'}"
							>
								{#if showResults}
									<div
										class="absolute inset-y-0 left-0 transition-all duration-500 ease-out {isSelected
											? 'bg-blue-500/15'
											: 'bg-gray-500/8'}"
										style="width: {pct}%"
									></div>
								{/if}
								<div class="relative flex w-full items-center justify-between">
									<div class="flex items-center gap-3">
										<input
											type="radio"
											name="choiceId"
											value={choice.id}
											bind:group={selectedChoiceId}
											class="h-4 w-4 text-blue-600 focus:ring-blue-500"
										/>
										<span class="text-sm font-medium text-gray-900">{choice.label}</span>
									</div>
									{#if showResults}
										<span class="text-xs text-gray-500">{votes} ({pct}%)</span>
									{/if}
								</div>
							</label>
						{/each}
					</fieldset>

					<button
						type="submit"
						disabled={!selectedChoiceId || submitting}
						class="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if submitting}
							<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								/>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
								/>
							</svg>
							Submitting…
						{:else}
							Submit Vote
						{/if}
					</button>
				</form>
			{:else if votingState === 'already-voted'}
				<!-- Already voted — show choices with results + highlight user's choice -->
				<div class="mt-4 space-y-2">
					{#each data.proposal.choices as choice}
						{@const result = resultsByChoice.get(choice.id)}
						{@const pct = result?.pct ?? 0}
						{@const votes = result?.votes ?? 0}
						{@const isUserChoice = data.userVote?.choiceId === choice.id}
						<div
							class="relative overflow-hidden rounded-lg border px-4 py-3
								{isUserChoice ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'}"
						>
							{#if showResults}
								<div
									class="absolute inset-y-0 left-0 transition-all duration-500 ease-out {isUserChoice
										? 'bg-blue-500/15'
										: 'bg-gray-500/8'}"
									style="width: {pct}%"
								></div>
							{/if}
							<div class="relative flex items-center justify-between">
								<div class="flex items-center gap-2">
									{#if isUserChoice}
										<svg
											class="h-4 w-4 shrink-0 text-blue-600"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												fill-rule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clip-rule="evenodd"
											/>
										</svg>
									{/if}
									<span
										class="text-sm font-medium {isUserChoice
											? 'text-blue-900'
											: 'text-gray-900'}">{choice.label}</span
									>
								</div>
								{#if showResults}
									<span
										class="text-xs {isUserChoice
											? 'font-medium text-blue-700'
											: 'text-gray-500'}">{votes} ({pct}%)</span
									>
								{/if}
							</div>
						</div>
					{/each}
				</div>
				<p class="mt-3 text-xs text-green-700">
					You voted for "{data.proposal.choices.find(
						(c) => c.id === data.userVote?.choiceId
					)?.label}". Your vote is locked.
				</p>
			{:else}
				<!-- Not member / not logged in / read-only -->
				<div class="mt-4 space-y-2">
					{#each data.proposal.choices as choice}
						{@const result = resultsByChoice.get(choice.id)}
						{@const pct = result?.pct ?? 0}
						{@const votes = result?.votes ?? 0}
						<div
							class="relative overflow-hidden rounded-lg border border-gray-200 px-4 py-3"
						>
							{#if showResults}
								<div
									class="absolute inset-y-0 left-0 bg-gray-500/8 transition-all duration-500 ease-out"
									style="width: {pct}%"
								></div>
							{/if}
							<div class="relative flex items-center justify-between">
								<span class="text-sm text-gray-700">{choice.label}</span>
								{#if showResults}
									<span class="text-xs text-gray-500">{votes} ({pct}%)</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				{#if votingState === 'not-member'}
					<p class="mt-3 text-xs text-gray-500">
						You must be a member to vote.
						<a
							href="/communities/{data.community.slug}"
							class="font-medium text-blue-600 hover:text-blue-800"
						>
							View community
						</a>
					</p>
				{:else if votingState === 'not-logged-in'}
					<p class="mt-3 text-xs text-gray-500">
						<a href="/login" class="font-medium text-blue-600 hover:text-blue-800">Sign in</a>
						to vote on this proposal.
					</p>
				{/if}
			{/if}
		</div>
	</div>
</div>
