<script lang="ts">
	import { enhance } from '$app/forms';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { formatRelativeTime } from '$lib/utils/format';
	import { resolve } from '$app/paths';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedChoiceId = $state<string | null>(null);
	let submitting = $state(false);
	let activeTab = $state<'description' | 'voters'>('description');

	const timeContext = $derived.by(() => {
		if (data.proposal.status === 'active') return `Voting closes ${formatRelativeTime(data.proposal.endTime)}`;
		if (data.proposal.status === 'closed') return `Voting closed ${formatRelativeTime(data.proposal.endTime)}`;
		return `Voting opens ${formatRelativeTime(data.proposal.startTime)}`;
	});

	const votingState = $derived.by(() => {
		if (data.proposal.status !== 'active') return 'read-only' as const;
		if (!data.user) return 'not-logged-in' as const;
		if (!data.membership) return 'not-member' as const;
		if (data.userVote) return 'already-voted' as const;
		return 'can-vote' as const;
	});

	const resultsByChoice = $derived.by(() => {
		const map = new Map<string, { votes: number; pct: number }>();
		for (const r of data.results.results) {
			const pct = data.results.totalVotes > 0 ? Math.round((r.votes / data.results.totalVotes) * 100) : 0;
			map.set(r.choiceId, { votes: r.votes, pct });
		}
		return map;
	});

	const showResults = $derived(
		data.proposal.status === 'active' || data.proposal.status === 'closed'
	);

	const userChoiceLabel = $derived(
		data.proposal.choices.find((c) => c.id === data.userVote?.choiceId)?.label
	);
</script>

<svelte:head>
	<title>{data.proposal.title} — VoteCast</title>
</svelte:head>

<div class="page" style="max-width: 1100px;">
	<a href={resolve(`/communities/${data.community.slug}`)} class="breadcrumb">
		{data.community.name}
	</a>

	<header class="page-head">
		<div>
			<h1 class="page-title">{data.proposal.title}</h1>
			<div style="margin-top: 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px;">
				<StatusBadge status={data.proposal.status as 'draft' | 'active' | 'closed'} />
				{#if data.proposal.visibility === 'public'}
					<span class="meta-pill">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
							<circle cx="12" cy="12" r="9" />
							<path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
						</svg>
						Public
					</span>
				{:else}
					<span class="meta-pill">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
							<rect x="4" y="11" width="16" height="10" rx="2" />
							<path d="M8 11V7a4 4 0 0 1 8 0v4" />
						</svg>
						Members only
					</span>
				{/if}
				<span style="color: var(--vc-muted); font-family: var(--vc-font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;">
					{timeContext}
				</span>
			</div>
		</div>
	</header>

	<div class="proposal-detail-grid">
		<div>
			<nav class="tabs">
				<button class="tab" class:active={activeTab === 'description'} onclick={() => (activeTab = 'description')}>
					Context
				</button>
				<button class="tab" class:active={activeTab === 'voters'} onclick={() => (activeTab = 'voters')}>
					Voters <span style="color: var(--vc-muted);">·</span> {data.results.totalVotes}
				</button>
			</nav>

			{#if activeTab === 'description'}
				<div style="white-space: pre-wrap; font-size: 15px; line-height: 1.65; color: var(--vc-ink-2);">
					{data.proposal.body}
				</div>
			{:else if data.voters.length === 0}
				<div class="empty">
					<p>No votes yet — be the first to weigh in.</p>
				</div>
			{:else}
				<div>
					{#each data.voters as voter (voter.userId)}
						<div class="member-row" style="padding: 12px 0;">
							<div class="member-info">
								<span class="member-name">
									<span>{voter.displayName || voter.name}</span>
								</span>
								<div class="member-meta">
									<span>{formatRelativeTime(voter.votedAt)}</span>
								</div>
							</div>
							<span class="meta-pill" style="background: var(--vc-bg-2);">{voter.choiceLabel}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<aside>
			<div class="vote-card">
				<div class="vote-card-head">
					<h2 class="vote-card-title">
						{votingState === 'can-vote' ? 'Your vote' : 'Result'}
					</h2>
					{#if showResults}
						<span class="vote-card-count">
							{data.results.totalVotes} {data.results.totalVotes === 1 ? 'vote' : 'votes'}
						</span>
					{/if}
				</div>

				{#if form?.error}
					<div class="alert alert-error" style="margin-bottom: 16px;">{form.error}</div>
				{/if}

				{#if form?.success}
					<div class="alert alert-success" style="margin-bottom: 16px;">Vote recorded.</div>
				{/if}

				{#if votingState === 'can-vote'}
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
						<fieldset disabled={submitting} style="border: 0; padding: 0; margin: 0;">
							{#each data.proposal.choices as choice (choice.id)}
								{@const result = resultsByChoice.get(choice.id)}
								{@const pct = result?.pct ?? 0}
								{@const votes = result?.votes ?? 0}
								{@const isSelected = selectedChoiceId === choice.id}
								<label class="choice" class:selected={isSelected}>
									{#if showResults}
										<div class="choice-fill" style="width: {pct}%"></div>
									{/if}
									<div class="choice-content">
										<input
											type="radio"
											name="choiceId"
											value={choice.id}
											bind:group={selectedChoiceId}
											style="position: absolute; opacity: 0; width: 1px; height: 1px;"
										/>
										<span class="choice-radio"></span>
										<span class="choice-label">{choice.label}</span>
										{#if showResults}
											<span class="choice-pct">{votes} · {pct}%</span>
										{/if}
									</div>
								</label>
							{/each}
						</fieldset>

						<button
							type="submit"
							disabled={!selectedChoiceId || submitting}
							class="btn btn-accent btn-lg"
							style="width: 100%; margin-top: 20px;"
						>
							{#if submitting}
								<span class="spinner"></span>
								Casting…
							{:else}
								Cast vote
							{/if}
						</button>
					</form>
				{:else if votingState === 'already-voted'}
					<div>
						{#each data.proposal.choices as choice (choice.id)}
							{@const result = resultsByChoice.get(choice.id)}
							{@const pct = result?.pct ?? 0}
							{@const votes = result?.votes ?? 0}
							{@const isUserChoice = data.userVote?.choiceId === choice.id}
							<div class="choice" class:user-pick={isUserChoice} style="cursor: default;">
								{#if showResults}
									<div class="choice-fill" style="width: {pct}%"></div>
								{/if}
								<div class="choice-content">
									{#if isUserChoice}
										<svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" style="flex-shrink: 0; color: var(--vc-accent);">
											<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
										</svg>
									{:else}
										<span class="choice-radio"></span>
									{/if}
									<span class="choice-label">{choice.label}</span>
									{#if showResults}
										<span class="choice-pct">{votes} · {pct}%</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
					<p style="margin-top: 16px; font-size: 13px; color: var(--vc-accent-ink);">
						You voted for "{userChoiceLabel}". Your vote is locked in.
					</p>
				{:else}
					<div>
						{#each data.proposal.choices as choice (choice.id)}
							{@const result = resultsByChoice.get(choice.id)}
							{@const pct = result?.pct ?? 0}
							{@const votes = result?.votes ?? 0}
							<div class="choice" style="cursor: default;">
								{#if showResults}
									<div class="choice-fill" style="width: {pct}%"></div>
								{/if}
								<div class="choice-content">
									<span class="choice-radio"></span>
									<span class="choice-label">{choice.label}</span>
									{#if showResults}
										<span class="choice-pct">{votes} · {pct}%</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>

					{#if votingState === 'not-member'}
						<p class="hint" style="margin-top: 16px;">
							You'll need to join {data.community.name} to vote.
							<a
								href={resolve(`/communities/${data.community.slug}`)}
								style="color: var(--vc-accent-ink); border-bottom: 1px solid var(--vc-line-2); margin-left: 4px;"
							>
								Open community
							</a>
						</p>
					{:else if votingState === 'not-logged-in'}
						<p class="hint" style="margin-top: 16px;">
							<a
								href={resolve('/login')}
								style="color: var(--vc-accent-ink); border-bottom: 1px solid var(--vc-line-2);"
							>
								Sign in
							</a>
							to weigh in on this one.
						</p>
					{/if}
				{/if}
			</div>
		</aside>
	</div>
</div>

<style>
	.proposal-detail-grid {
		display: grid;
		gap: 40px;
		grid-template-columns: 1fr;
	}
	@media (min-width: 960px) {
		.proposal-detail-grid {
			grid-template-columns: 1.6fr 1fr;
			align-items: start;
		}
	}
</style>
