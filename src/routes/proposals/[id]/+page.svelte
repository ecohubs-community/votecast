<script lang="ts">
	import { enhance } from '$app/forms';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import MethodFlow from '$lib/components/MethodFlow.svelte';
	import { formatRelativeTime } from '$lib/utils/format';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const pageTitle = $derived(`${data.proposal.title} — VoteCast`);
	const canonical = $derived(new URL(`/proposals/${data.proposal.id}`, page.url.origin).href);
	const ogImage = $derived(new URL('/og-default.jpg', page.url.origin).href);
	const isPublic = $derived(
		data.proposal.visibility === 'public' && data.community.visibility === 'public'
	);
	const metaDescription = $derived(
		(
			data.proposal.body?.replace(/\s+/g, ' ').trim() ||
			`A proposal in ${data.community.name} on VoteCast — cast your vote and see transparent results.`
		).slice(0, 200)
	);

	let selectedChoiceId = $state<string | null>(null);
	let submitting = $state(false);
	let activeTab = $state<'description' | 'voters'>('description');

	const timeContext = $derived.by(() => {
		if (data.proposal.phase === 'voting')
			return `Voting closes ${formatRelativeTime(data.proposal.endTime)}`;
		if (data.proposal.phase === 'finalized' || data.proposal.phase === 'objection-window')
			return `Voting closed ${formatRelativeTime(data.proposal.endTime)}`;
		return `Voting opens ${formatRelativeTime(data.proposal.startTime)}`;
	});

	const votingState = $derived.by(() => {
		if (data.proposal.phase !== 'voting') return 'read-only' as const;
		if (!data.user) return 'not-logged-in' as const;
		if (!data.membership) return 'not-member' as const;
		if (data.userVote) return 'already-voted' as const;
		return 'can-vote' as const;
	});

	const resultsByChoice = $derived.by(() => {
		const map = new Map<string, { votes: number; pct: number }>();
		for (const r of data.results.results) {
			const pct =
				data.results.totalVotes > 0 ? Math.round((r.votes / data.results.totalVotes) * 100) : 0;
			map.set(r.choiceId, { votes: r.votes, pct });
		}
		return map;
	});

	const showResults = $derived(
		data.proposal.phase !== 'draft' && data.proposal.phase !== 'deliberation'
	);

	const OUTCOME_LABELS: Record<string, string> = {
		passed: 'Passed',
		failed: 'Failed',
		blocked: 'Blocked',
		tie: 'Tie',
		'quorum-not-met': 'No quorum',
		indeterminate: 'No result',
		provisional: 'Pending',
		recorded: 'Recorded'
	};
	const outcomeLabel = $derived(
		data.outcome?.revealed && data.outcome.result
			? (OUTCOME_LABELS[data.outcome.result.outcome] ?? data.outcome.result.outcome)
			: null
	);

	const userChoiceLabel = $derived(
		data.proposal.choices.find((c) => c.id === data.userVote?.choiceId)?.label
	);
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={metaDescription} />
	<link rel="canonical" href={canonical} />
	{#if !isPublic}
		<meta name="robots" content="noindex, nofollow" />
	{/if}
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={ogImage} />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={metaDescription} />
	<meta name="twitter:image" content={ogImage} />
</svelte:head>

<div class="page" style="max-width: 1100px;">
	<a href={resolve(`/communities/${data.community.slug}`)} class="breadcrumb">
		{data.community.name}
	</a>

	<header class="page-head">
		<div>
			<h1 class="page-title">{data.proposal.title}</h1>
			<div
				style="margin-top: 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px;"
			>
				<StatusBadge phase={data.proposal.phase} />
				{#if data.proposal.visibility === 'public'}
					<span class="meta-pill">
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
				{:else}
					<span class="meta-pill">
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
						Members only
					</span>
				{/if}
				<span
					style="color: var(--vc-muted); font-family: var(--vc-font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;"
				>
					{timeContext}
				</span>
			</div>
		</div>
	</header>

	{#if data.method}
		<section style="margin-bottom: 28px;">
			<MethodFlow
				ballotModuleId={data.method.ballotModuleId}
				decisionRuleId={data.method.decisionRuleId}
				deliberationSeconds={data.method.deliberationSeconds}
				objectionWindowSeconds={data.method.objectionWindowSeconds}
				tallyReveal={data.method.tallyReveal}
				startTime={data.proposal.startTime}
				endTime={data.proposal.endTime}
				currentPhase={data.proposal.phase}
			/>
		</section>
	{/if}

	<div class="proposal-detail-grid">
		<div>
			<nav class="tabs">
				<button
					class="tab"
					class:active={activeTab === 'description'}
					onclick={() => (activeTab = 'description')}
				>
					Context
				</button>
				<button
					class="tab"
					class:active={activeTab === 'voters'}
					onclick={() => (activeTab = 'voters')}
				>
					Voters <span style="color: var(--vc-muted);">·</span>
					{data.results.totalVotes}
				</button>
			</nav>

			{#if activeTab === 'description'}
				<div
					style="white-space: pre-wrap; font-size: 15px; line-height: 1.65; color: var(--vc-ink-2);"
				>
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
							{data.results.totalVotes}
							{data.results.totalVotes === 1 ? 'vote' : 'votes'}
						</span>
					{/if}
				</div>

				{#if outcomeLabel}
					<div class="outcome-badge" data-outcome={data.outcome?.result?.outcome}>
						Outcome: <strong>{outcomeLabel}</strong>
					</div>
				{/if}

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
										<svg
											width="18"
											height="18"
											viewBox="0 0 20 20"
											fill="currentColor"
											style="flex-shrink: 0; color: var(--vc-accent);"
										>
											<path
												fill-rule="evenodd"
												d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
												clip-rule="evenodd"
											/>
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
	.outcome-badge {
		margin-bottom: 16px;
		padding: 8px 12px;
		border-radius: var(--vc-radius-sm, 8px);
		background: var(--vc-surface-2, rgba(0, 0, 0, 0.04));
		font-size: 14px;
		color: var(--vc-ink-2);
	}
	.outcome-badge[data-outcome='passed'] {
		background: var(--vc-success-soft, rgba(34, 160, 100, 0.12));
		color: var(--vc-success-ink, #1a7f53);
	}
	.outcome-badge[data-outcome='failed'],
	.outcome-badge[data-outcome='blocked'] {
		background: var(--vc-error-soft, rgba(200, 60, 60, 0.12));
		color: var(--vc-error-ink, #b23b3b);
	}
</style>
