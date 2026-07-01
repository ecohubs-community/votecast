<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import MethodFlow from '$lib/components/MethodFlow.svelte';
	import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
	import VisibilityToggle from '$lib/components/VisibilityToggle.svelte';
	import Button from '$lib/components/Button.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const FALLBACK_CHOICES = ['For', 'Against', 'Abstain'];
	const DEFAULT_VOTING_SECONDS = 259_200; // 3 days

	/** Format a Date for a `datetime-local` input (local time, no seconds/offset). */
	function toLocalInput(d: Date): string {
		const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
		return local.toISOString().slice(0, 16);
	}
	function fmtDateTime(iso: string): string {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '—';
		return d.toLocaleString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
	function fmtDuration(seconds: number): string {
		if (seconds <= 0) return '';
		const days = Math.round(seconds / 86_400);
		if (days >= 1) return `${days} day${days > 1 ? 's' : ''}`;
		const hours = Math.max(1, Math.round(seconds / 3_600));
		return `${hours} hour${hours > 1 ? 's' : ''}`;
	}

	const nowIso = toLocalInput(new Date());

	// The selected type drives every default and lock below. Writable $derived: a user choice
	// reassigns it; it reseeds only when the form/data change.
	let typeVersionId = $derived(form?.typeVersionId ?? data.types[0]?.currentVersionId ?? '');
	const selectedType = $derived(data.types.find((t) => t.currentVersionId === typeVersionId));
	const isMultiQuestion = $derived(selectedType?.ballotModuleId === 'multi-question');

	const lockChoices = $derived(selectedType?.lockChoices ?? false);
	const lockVisibility = $derived(selectedType?.lockVisibility ?? false);
	const lockVoting = $derived(selectedType?.lockVoting ?? false);
	const deliberationSeconds = $derived(selectedType?.deliberationSeconds ?? 0);

	// Choices: form echo (error) → type defaults → For/Against/Abstain. Spread so we never mutate a
	// shared array via bind:value.
	let choices = $derived(
		form?.choices?.length
			? [...form.choices]
			: [...(selectedType?.defaultChoices ?? FALLBACK_CHOICES)]
	);

	let visibility = $derived<'public' | 'community'>(
		(form?.visibility as 'public' | 'community') ?? selectedType?.defaultVisibility ?? 'public'
	);

	// Timeline. Voting opens after the deliberation window (so deliberation can begin at creation, not
	// before it); with no deliberation it opens now. End = start + the type's voting window (3d default).
	const nowMs = new Date(nowIso).getTime();
	// Earliest voting start that keeps deliberation from beginning before the proposal exists.
	const minStart = $derived(toLocalInput(new Date(nowMs + deliberationSeconds * 1000)));
	let startTime = $derived(form?.startTime ?? minStart);
	let endTime = $derived.by(() => {
		if (form?.endTime) return form.endTime;
		const secs = selectedType?.votingSeconds ?? DEFAULT_VOTING_SECONDS;
		return toLocalInput(new Date(new Date(startTime).getTime() + secs * 1000));
	});
	const deliberationStart = $derived(
		toLocalInput(new Date(new Date(startTime).getTime() - deliberationSeconds * 1000))
	);

	// `min` on a datetime-local only flags invalidity on submit (and the time, not just the date, can
	// still be set past it), so validate the window explicitly and block submit with a clear message.
	const timelineError = $derived(
		new Date(endTime).getTime() <= new Date(startTime).getTime()
			? 'Voting needs to close after it opens.'
			: deliberationSeconds > 0 && new Date(deliberationStart).getTime() < nowMs
				? 'Deliberation would begin before the proposal is created — open voting later.'
				: null
	);

	let editStart = $state(false);
	let editEnd = $state(false);
	let showRationale = $state(untrack(() => Boolean(form?.rationale)));

	function addChoice() {
		if (choices.length < 20) choices = [...choices, ''];
	}
	function removeChoice(index: number) {
		if (choices.length > 2) choices = choices.filter((_, i) => i !== index);
	}

	// Common Ground: the proposal collects questions (each gets Agree/Disagree/Abstain) instead of choices.
	let questions = $derived(form?.questions?.length ? [...form.questions] : ['']);

	// Common Ground: who/when may add more questions — pre-filled from the type, locked when the type says so.
	const lockQuestionContribution = $derived(selectedType?.lockQuestionContribution ?? false);
	let qPhase = $derived<'creation' | 'deliberation'>(
		selectedType?.questionContributionPhase ?? 'creation'
	);
	let qWho = $derived<'proposer' | 'members'>(selectedType?.questionContributors ?? 'proposer');
	function addQuestion() {
		if (questions.length < 20) questions = [...questions, ''];
	}
	function removeQuestion(index: number) {
		if (questions.length > 1) questions = questions.filter((_, i) => i !== index);
	}
</script>

<svelte:head>
	<title>New proposal — {data.community.name}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page">
	<a href={resolve(`/communities/${data.community.slug}`)} class="breadcrumb"
		>{data.community.name}</a
	>

	<header class="page-head">
		<div>
			<h1 class="page-title">Open a <em>proposal.</em></h1>
			<p class="page-sub">
				Write what's being decided. Add the options. The method's defaults fill in the rest.
			</p>
		</div>
	</header>

	{#if form?.error}
		<Alert variant="error" class="mb-6">{form.error}</Alert>
	{/if}

	<form method="POST" use:enhance>
		<div style="display: grid; gap: 32px; grid-template-columns: 1fr;" class="proposal-grid">
			<div class="form-stack">
				<div class="field">
					<label for="title" class="label">Title</label>
					<input
						type="text"
						id="title"
						name="title"
						required
						maxlength="200"
						value={form?.title ?? ''}
						class="input"
						placeholder="What should the community decide?"
					/>
				</div>

				<div class="field">
					{#if showRationale}
						<div class="rationale-head">
							<span class="label">Rationale <span class="label-optional">optional</span></span>
							<button type="button" class="link-muted" onclick={() => (showRationale = false)}>
								Remove
							</button>
						</div>
						<MarkdownEditor
							name="rationale"
							value={form?.rationale ?? ''}
							rows={6}
							placeholder="The reasoning behind this proposal — context, trade-offs, why now. Kept separate from the text that's voted on."
						/>
					{:else}
						<button type="button" class="add-rationale" onclick={() => (showRationale = true)}>
							+ Add rationale
						</button>
					{/if}
				</div>

				<div class="field">
					<span class="label">Proposal</span>
					<MarkdownEditor
						name="body"
						value={form?.body ?? ''}
						rows={14}
						required
						placeholder="What's being voted on, what each option means, anything members should know before deciding…"
					/>
				</div>
			</div>

			<div class="form-stack">
				{#if data.types.length > 0}
					<div class="field">
						<label for="type" class="label">Method</label>
						<select id="type" name="typeVersionId" bind:value={typeVersionId} class="input">
							{#each data.types as t (t.currentVersionId)}
								<option value={t.currentVersionId}>{t.name}</option>
							{/each}
						</select>
						{#if selectedType}
							<p class="hint">{selectedType.description}</p>
							<MethodFlow
								ballotModuleId={selectedType.ballotModuleId}
								decisionRuleId={selectedType.decisionRuleId}
								deliberationSeconds={selectedType.deliberationSeconds}
								objectionWindowSeconds={selectedType.objectionWindowSeconds}
								tallyReveal={selectedType.tallyReveal}
							/>
						{/if}
					</div>
				{/if}

				<div class="field">
					<span class="label">Who can see it</span>
					{#if lockVisibility && selectedType}
						<p class="locked-value">
							{selectedType.defaultVisibility === 'public' ? 'Public' : 'Members only'}
							<span class="locked-tag">set by method</span>
						</p>
						<input type="hidden" name="visibility" value={selectedType.defaultVisibility} />
					{:else}
						<VisibilityToggle bind:value={visibility} />
						<p class="hint">
							{visibility === 'public'
								? 'Anyone — even non-members — can read this proposal and see the result.'
								: 'Only people in this community can see it.'}
						</p>
					{/if}
				</div>

				<div class="field">
					<span class="label">Timeline</span>
					<ol class="timeline">
						<li class="tl-row">
							<span class="tl-when">Created</span>
							<span class="tl-line"><span class="tl-val">{fmtDateTime(nowIso)}</span></span>
						</li>
						{#if deliberationSeconds > 0}
							<li class="tl-row">
								<span class="tl-when">Deliberation opens</span>
								<span class="tl-line">
									<span class="tl-val">{fmtDateTime(deliberationStart)}</span>
									<span class="tl-note">{fmtDuration(deliberationSeconds)} before voting</span>
								</span>
							</li>
						{/if}
						<li class="tl-row">
							<span class="tl-when">Voting opens</span>
							<span class="tl-line">
								{#if editStart && !lockVoting}
									<input
										type="datetime-local"
										name="startTime"
										bind:value={startTime}
										min={minStart}
										class="input tl-input"
									/>
									<button type="button" class="tl-edit" onclick={() => (editStart = false)}>
										Done
									</button>
								{:else}
									<span class="tl-val">{fmtDateTime(startTime)}</span>
									{#if lockVoting}
										<span class="locked-tag">set by method</span>
									{:else}
										<button type="button" class="tl-edit" onclick={() => (editStart = true)}>
											Edit
										</button>
									{/if}
									<input type="hidden" name="startTime" value={startTime} />
								{/if}
							</span>
						</li>
						<li class="tl-row">
							<span class="tl-when">Voting closes</span>
							<span class="tl-line">
								{#if editEnd && !lockVoting}
									<input
										type="datetime-local"
										name="endTime"
										bind:value={endTime}
										min={startTime}
										class="input tl-input"
									/>
									<button type="button" class="tl-edit" onclick={() => (editEnd = false)}>
										Done
									</button>
								{:else}
									<span class="tl-val">{fmtDateTime(endTime)}</span>
									{#if lockVoting}
										<span class="locked-tag">set by method</span>
									{:else}
										<button type="button" class="tl-edit" onclick={() => (editEnd = true)}>
											Edit
										</button>
									{/if}
									<input type="hidden" name="endTime" value={endTime} />
								{/if}
							</span>
						</li>
					</ol>
					{#if timelineError}
						<p class="field-error">{timelineError}</p>
					{/if}
				</div>

				<div class="field">
					<span class="label">
						{isMultiQuestion ? 'Questions' : 'Choices'}
						{#if !lockChoices && !isMultiQuestion}<span class="label-optional">2–20</span>{/if}
					</span>

					{#if isMultiQuestion}
						<p class="hint">
							Each question is answered Agree / Disagree / Abstain and tallied on its own.
						</p>
						<div style="display: flex; flex-direction: column; gap: 8px;">
							<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -- index-only loop; bound via questions[i] -->
							{#each questions as _, i (i)}
								<div style="display: flex; gap: 8px;">
									<input
										type="text"
										name="questions"
										required
										maxlength="280"
										bind:value={questions[i]}
										class="input"
										aria-label="Question {i + 1}"
										placeholder="Question {i + 1}"
									/>
									{#if questions.length > 1}
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onclick={() => removeQuestion(i)}
										>
											Remove
										</Button>
									{/if}
								</div>
							{/each}
						</div>
						{#if questions.length < 20}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onclick={addQuestion}
								class="mt-2 self-start"
							>
								+ Add a question
							</Button>
						{/if}

						<div class="mq-contrib">
							<span class="label">Adding more questions later</span>
							{#if lockQuestionContribution}
								<p class="locked-value">
									{qPhase === 'creation'
										? 'Fixed at creation'
										: `During deliberation — ${qWho === 'members' ? 'any member' : 'proposer only'}`}
									<span class="locked-tag">set by method</span>
								</p>
								<input type="hidden" name="questionContributionPhase" value={qPhase} />
								<input type="hidden" name="questionContributors" value={qWho} />
							{:else}
								<select name="questionContributionPhase" bind:value={qPhase} class="input">
									<option value="creation">Only at creation</option>
									<option value="deliberation">During the deliberation phase</option>
								</select>
								{#if qPhase === 'deliberation'}
									<select
										name="questionContributors"
										bind:value={qWho}
										class="input"
										style="margin-top: 8px;"
									>
										<option value="proposer">Proposer only</option>
										<option value="members">Any member</option>
									</select>
								{/if}
							{/if}
						</div>
					{:else if lockChoices}
						<ul class="locked-choices">
							{#each choices as choice, i (i)}
								<li>{choice}</li>
								<input type="hidden" name="choices" value={choice} />
							{/each}
						</ul>
						<p class="hint"><span class="locked-tag">set by method</span></p>
					{:else}
						<div style="display: flex; flex-direction: column; gap: 8px;">
							<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -- index-only loop; the value is bound via choices[i] since each-block primitives aren't writable refs -->
							{#each choices as _, i (i)}
								<div style="display: flex; gap: 8px;">
									<input
										type="text"
										name="choices"
										required
										maxlength="200"
										bind:value={choices[i]}
										class="input"
										aria-label="Option {i + 1}"
										placeholder="Option {i + 1}"
									/>
									{#if choices.length > 2}
										<Button type="button" variant="ghost" size="sm" onclick={() => removeChoice(i)}>
											Remove
										</Button>
									{/if}
								</div>
							{/each}
						</div>
						{#if choices.length < 20}
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onclick={addChoice}
								class="mt-2 self-start"
							>
								+ Add a choice
							</Button>
						{/if}
					{/if}
				</div>
			</div>
		</div>

		<div class="form-actions">
			<Button type="submit" variant="accent" size="lg" disabled={!!timelineError}>
				Open proposal
			</Button>
			<Button href={resolve(`/communities/${data.community.slug}`)} variant="ghost" size="lg"
				>Cancel</Button
			>
		</div>
	</form>
</div>

<style>
	@media (min-width: 960px) {
		.proposal-grid {
			grid-template-columns: 1.4fr 1fr !important;
		}
	}

	/* Rationale — low-weight affordances */
	.rationale-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	.add-rationale,
	.link-muted {
		font: inherit;
		font-size: 13px;
		background: none;
		border: none;
		padding: 0;
		color: var(--vc-muted);
		cursor: pointer;
	}
	.add-rationale:hover,
	.link-muted:hover {
		color: var(--vc-ink);
	}

	/* Vertical timeline with dots + connecting lines */
	.timeline {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.tl-row {
		position: relative;
		padding: 0 0 16px 22px;
	}
	.tl-row:last-child {
		padding-bottom: 0;
	}
	.tl-row::before {
		content: '';
		position: absolute;
		left: 2px;
		top: 3px;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--vc-surface);
		border: 2px solid var(--vc-accent);
		box-sizing: border-box;
	}
	.tl-row::after {
		content: '';
		position: absolute;
		left: 6px;
		top: 14px;
		bottom: -2px;
		width: 2px;
		background: var(--vc-line);
	}
	.tl-row:last-child::after {
		display: none;
	}
	.tl-when {
		display: block;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--vc-muted);
		margin-bottom: 3px;
	}
	.tl-line {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.tl-val {
		font-size: 14px;
		color: var(--vc-ink);
	}
	.tl-note {
		font-size: 12px;
		color: var(--vc-muted);
	}
	.field-error {
		margin: 10px 0 0;
		font-size: 13px;
		color: var(--vc-danger, #c0392b);
	}
	.tl-input {
		max-width: 230px;
	}
	.tl-edit {
		font: inherit;
		font-size: 13px;
		background: none;
		border: none;
		color: var(--vc-accent-ink, var(--vc-accent));
		cursor: pointer;
		padding: 0;
		border-bottom: 1px solid var(--vc-line-2);
	}
	.mq-contrib {
		margin-top: 16px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.locked-value {
		font-size: 14px;
		color: var(--vc-ink);
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.locked-choices {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
	}
	.locked-tag {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--vc-muted);
		border: 1px solid var(--vc-line);
		border-radius: 5px;
		padding: 1px 6px;
	}
</style>
