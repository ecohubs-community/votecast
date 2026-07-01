<script lang="ts">
	import { enhance } from '$app/forms';
	import Spinner from '$lib/components/Spinner.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import MethodFlow from '$lib/components/MethodFlow.svelte';
	import Markdown from '$lib/components/Markdown.svelte';
	import MultiQuestionBallot from '$lib/components/MultiQuestionBallot.svelte';
	import BallotChoice from '$lib/components/BallotChoice.svelte';
	import Button from '$lib/components/Button.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import VisibilityPill from '$lib/components/VisibilityPill.svelte';
	import { formatRelativeTime } from '$lib/utils/format';
	import { ballotLabel, ruleLabel } from '$lib/utils/method-labels';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { SvelteMap } from 'svelte/reactivity';
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
	let activeTab = $state<'description' | 'rationale' | 'voters'>('description');

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
		const map = new SvelteMap<string, { votes: number; pct: number }>();
		for (const r of data.results.results) {
			const pct =
				data.results.totalVotes > 0 ? Math.round((r.votes / data.results.totalVotes) * 100) : 0;
			map.set(r.choiceId, { votes: r.votes, pct });
		}
		return map;
	});

	// Gate the tally on the method's reveal policy (live / on-close / hidden-forever) + the viewer's
	// role, not just phase — `getProposalOutcome` already resolved exactly that into `outcome.revealed`.
	const showResults = $derived(data.outcome?.revealed ?? false);

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
	// A single-choice (plurality) vote over arbitrary options has no global pass/fail — it has a
	// *winner*. So name the winning option ("Result: No") instead of claiming "Passed". Consent/
	// consensus ballots keep a true Passed/Failed/Blocked verdict, coloured accordingly.
	const resultHeadline = $derived.by(() => {
		const r = data.outcome?.revealed ? data.outcome.result : null;
		if (!r) return null;
		// A plurality single-choice vote names its winner; an approval vote (approve vs reject) has a
		// true verdict, so it keeps Passed/Failed like the consensus/consent ballots.
		const isApproval = data.method?.decisionRuleId?.startsWith('approval') ?? false;
		if (data.method?.ballotModuleId === 'single-choice' && !isApproval) {
			if (r.outcome === 'tie') return { prefix: '', value: 'Tie', dataOutcome: 'tie' };
			const winner = r.entries.find((e) => e.outcome === 'passed');
			if (winner) return { prefix: 'Result:', value: winner.label, dataOutcome: undefined };
			return {
				prefix: '',
				value: OUTCOME_LABELS[r.outcome] ?? r.outcome,
				dataOutcome: undefined
			};
		}
		return {
			prefix: 'Outcome:',
			value: OUTCOME_LABELS[r.outcome] ?? r.outcome,
			dataOutcome: r.outcome
		};
	});

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

<div class="page">
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
				<VisibilityPill visibility={data.proposal.visibility} />
				<span
					style="color: var(--vc-muted); font-family: var(--vc-font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;"
				>
					{timeContext}
				</span>
			</div>
		</div>
	</header>

	{#if data.method}
		<section class="method-summary">
			<div class="method-summary-head">
				<span class="method-name">
					{ballotLabel(data.method.ballotModuleId)} · {ruleLabel(data.method.decisionRuleId)}
				</span>
			</div>
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
					Proposal
				</button>
				{#if data.rationaleHtml}
					<button
						class="tab"
						class:active={activeTab === 'rationale'}
						onclick={() => (activeTab = 'rationale')}
					>
						Rationale
					</button>
				{/if}
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
				<Markdown html={data.bodyHtml} />
			{:else if activeTab === 'rationale'}
				<Markdown html={data.rationaleHtml ?? ''} />
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
							{#if voter.choiceLabel}
								<span class="meta-pill" style="background: var(--vc-bg-2);"
									>{voter.choiceLabel}</span
								>
							{/if}
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
						<span class="font-mono text-xs tracking-[var(--vc-tracking-mono)] text-muted uppercase">
							{data.results.totalVotes}
							{data.results.totalVotes === 1 ? 'vote' : 'votes'}
						</span>
					{/if}
				</div>

				{#if resultHeadline && !data.isMultiQuestion}
					<div class="outcome-badge" data-outcome={resultHeadline.dataOutcome}>
						{resultHeadline.prefix}
						<strong>{resultHeadline.value}</strong>
					</div>
				{/if}

				{#if form?.error}
					<Alert variant="error" class="mb-4">{form.error}</Alert>
				{/if}

				{#if form?.success}
					<Alert variant="success" class="mb-4">Vote recorded.</Alert>
				{/if}

				{#if data.isMultiQuestion}
					<MultiQuestionBallot
						questions={data.questions}
						userAnswers={data.userAnswers}
						canVote={votingState === 'can-vote'}
						hasVoted={votingState === 'already-voted'}
						{showResults}
						entries={data.outcome?.revealed ? (data.outcome.result?.entries ?? null) : null}
						canAddQuestion={data.canAddQuestion}
						questionNote={data.questionNote}
						voteHint={votingState === 'not-member'
							? `Join ${data.community.name} to weigh in.`
							: votingState === 'not-logged-in'
								? 'Sign in to weigh in on this one.'
								: null}
						{form}
					/>
				{:else if votingState === 'can-vote'}
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
						<fieldset disabled={submitting} class="m-0 space-y-2.5 border-0 p-0">
							{#each data.proposal.choices as choice (choice.id)}
								{@const result = resultsByChoice.get(choice.id)}
								{@const pct = result?.pct ?? 0}
								{@const votes = result?.votes ?? 0}
								<BallotChoice
									label={choice.label}
									interactive
									highlighted={selectedChoiceId === choice.id}
									showFill={showResults}
									{pct}
									detail={showResults ? `${votes} · ${pct}%` : null}
								>
									<input
										type="radio"
										name="choiceId"
										value={choice.id}
										bind:group={selectedChoiceId}
										class="absolute h-px w-px opacity-0"
									/>
								</BallotChoice>
							{/each}
						</fieldset>

						<Button
							type="submit"
							variant="accent"
							size="lg"
							disabled={!selectedChoiceId || submitting}
							class="mt-5 w-full"
						>
							{#if submitting}
								<Spinner />
								Casting…
							{:else}
								Cast vote
							{/if}
						</Button>
					</form>
				{:else if votingState === 'already-voted'}
					<div class="space-y-2.5">
						{#each data.proposal.choices as choice (choice.id)}
							{@const result = resultsByChoice.get(choice.id)}
							{@const pct = result?.pct ?? 0}
							{@const votes = result?.votes ?? 0}
							{@const isUserChoice = data.userVote?.choiceId === choice.id}
							<BallotChoice
								label={choice.label}
								highlighted={isUserChoice}
								marker={isUserChoice ? 'check' : 'radio'}
								showFill={showResults}
								{pct}
								detail={showResults ? `${votes} · ${pct}%` : null}
							/>
						{/each}
					</div>
					<p style="margin-top: 16px; font-size: 13px; color: var(--vc-accent-ink);">
						You voted for "{userChoiceLabel}". Your vote is locked in.
					</p>
				{:else}
					<div class="space-y-2.5">
						{#each data.proposal.choices as choice (choice.id)}
							{@const result = resultsByChoice.get(choice.id)}
							{@const pct = result?.pct ?? 0}
							{@const votes = result?.votes ?? 0}
							<BallotChoice
								label={choice.label}
								showFill={showResults}
								{pct}
								detail={showResults ? `${votes} · ${pct}%` : null}
							/>
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
	.method-summary {
		margin-bottom: 28px;
	}
	.method-summary-head {
		margin-bottom: 8px;
	}
	.method-name {
		font-size: 13px;
		font-weight: 600;
		color: var(--vc-ink);
	}
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
