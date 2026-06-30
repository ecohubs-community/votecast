<script lang="ts">
	import { enhance } from '$app/forms';

	type Choice = { id: string; label: string; position: number };
	type Question = { id: string; prompt: string; choices: Choice[] };
	type Entry = {
		key: string;
		outcome: string;
		tallyForWeight: number;
		tallyAgainstWeight?: number;
	};

	let {
		questions,
		userAnswers,
		canVote,
		hasVoted,
		showResults,
		entries,
		canAddQuestion,
		questionNote,
		form
	}: {
		questions: Question[];
		userAnswers: Record<string, string>;
		canVote: boolean;
		hasVoted: boolean;
		showResults: boolean;
		entries: Entry[] | null;
		canAddQuestion: boolean;
		questionNote: string | null;
		form: { questionError?: string; questionAdded?: boolean } | null;
	} = $props();

	// Local selections for the voting form (one position-choice per question).
	let answers = $state<Record<string, string>>({});
	let submitting = $state(false);
	const allAnswered = $derived(questions.every((q) => answers[q.id]));

	const entryByQuestion = $derived(new Map((entries ?? []).map((e) => [e.key, e])));
	function outcomeLabel(o: string): string {
		return o === 'passed' ? 'Agreed' : o === 'failed' ? 'Not agreed' : o === 'tie' ? 'Split' : o;
	}
</script>

<div class="mq">
	{#if canVote}
		<form
			method="POST"
			action="?/vote"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			{#each questions as q (q.id)}
				<fieldset class="mq-q">
					<legend>{q.prompt}</legend>
					<div class="mq-options">
						{#each q.choices as c (c.id)}
							<label class="mq-opt" class:selected={answers[q.id] === c.id}>
								<input type="radio" name={`q_${q.id}`} value={c.id} bind:group={answers[q.id]} />
								{c.label}
							</label>
						{/each}
					</div>
				</fieldset>
			{/each}
			<button type="submit" class="btn btn-accent" disabled={!allAnswered || submitting}>
				{submitting ? 'Submitting…' : 'Submit answers'}
			</button>
		</form>
	{:else}
		{#each questions as q (q.id)}
			{@const entry = entryByQuestion.get(q.id)}
			<div class="mq-q">
				<p class="mq-prompt">{q.prompt}</p>
				<div class="mq-options">
					{#each q.choices as c (c.id)}
						<span class="mq-opt" class:selected={hasVoted && userAnswers[q.id] === c.id}>
							{c.label}
							{#if hasVoted && userAnswers[q.id] === c.id}<span class="mq-you">your answer</span
								>{/if}
						</span>
					{/each}
				</div>
				{#if showResults && entry}
					<p class="mq-result" data-outcome={entry.outcome}>
						{outcomeLabel(entry.outcome)} — {entry.tallyForWeight} agree · {entry.tallyAgainstWeight ??
							0} disagree
					</p>
				{/if}
			</div>
		{/each}
	{/if}

	{#if canAddQuestion}
		<form method="POST" action="?/addQuestion" use:enhance class="mq-add">
			{#if form?.questionError}
				<div class="alert alert-error" style="margin-bottom: 8px;">{form.questionError}</div>
			{/if}
			{#if form?.questionAdded}
				<div class="alert alert-success" style="margin-bottom: 8px;">Question added.</div>
			{/if}
			<label for="mq-prompt" class="label">Add a question</label>
			<div style="display: flex; gap: 8px;">
				<input
					type="text"
					id="mq-prompt"
					name="prompt"
					required
					maxlength="280"
					class="input"
					placeholder="Propose another question for the group"
				/>
				<button type="submit" class="btn btn-ghost btn-sm">Add</button>
			</div>
		</form>
	{:else if questionNote}
		<p class="mq-note">{questionNote}</p>
	{/if}
</div>

<style>
	.mq-q {
		border: none;
		padding: 0;
		margin: 0 0 18px;
	}
	.mq-q legend,
	.mq-prompt {
		font-size: 15px;
		font-weight: 600;
		color: var(--vc-ink);
		margin: 0 0 8px;
		padding: 0;
	}
	.mq-options {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.mq-opt {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border: 1px solid var(--vc-line);
		border-radius: 8px;
		font-size: 14px;
		cursor: pointer;
	}
	.mq-opt.selected {
		border-color: var(--vc-accent);
		background: var(--vc-accent-soft);
	}
	.mq-you {
		font-size: 11px;
		color: var(--vc-muted);
	}
	.mq-result {
		margin: 8px 0 0;
		font-size: 13px;
		color: var(--vc-muted);
	}
	.mq-result[data-outcome='passed'] {
		color: var(--vc-success-ink, #1a7f53);
	}
	.mq-add {
		margin-top: 20px;
		padding-top: 16px;
		border-top: 1px solid var(--vc-line);
	}
	.mq-note {
		margin: 20px 0 0;
		padding-top: 16px;
		border-top: 1px solid var(--vc-line);
		font-size: 13px;
		color: var(--vc-muted);
	}
</style>
