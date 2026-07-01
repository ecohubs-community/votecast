<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/Button.svelte';
	import Alert from '$lib/components/Alert.svelte';

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
		voteHint,
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
		voteHint: string | null;
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

	const optBase =
		'inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[14px]';
	const promptCls = 'm-0 mb-2 p-0 text-[15px] font-semibold text-ink';
</script>

<div>
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
				<fieldset class="m-0 mb-[18px] border-none p-0">
					<legend class={promptCls}>{q.prompt}</legend>
					<div class="mq-options">
						{#each q.choices as c (c.id)}
							<label
								class="{optBase} {answers[q.id] === c.id
									? 'border-accent bg-accent-soft'
									: 'border-line'}"
							>
								<input type="radio" name={`q_${q.id}`} value={c.id} bind:group={answers[q.id]} />
								{c.label}
							</label>
						{/each}
					</div>
				</fieldset>
			{/each}
			<Button type="submit" variant="accent" disabled={!allAnswered || submitting}>
				{submitting ? 'Submitting…' : 'Submit answers'}
			</Button>
		</form>
	{:else}
		{#if !hasVoted && voteHint}
			<p class="m-0 mb-4 text-[14px] text-muted">{voteHint}</p>
		{/if}
		{#each questions as q (q.id)}
			{@const entry = entryByQuestion.get(q.id)}
			<div class="m-0 mb-[18px] border-none p-0">
				<p class={promptCls}>{q.prompt}</p>
				<div class="mq-options">
					{#each q.choices as c (c.id)}
						<span
							class="{optBase} {hasVoted && userAnswers[q.id] === c.id
								? 'border-accent bg-accent-soft'
								: 'border-line'}"
						>
							{c.label}
							{#if hasVoted && userAnswers[q.id] === c.id}<span class="text-[11px] text-muted"
									>your answer</span
								>{/if}
						</span>
					{/each}
				</div>
				{#if showResults && entry}
					<p
						class="mt-2 mb-0 text-[13px] text-muted data-[outcome=passed]:text-[#1a7f53]"
						data-outcome={entry.outcome}
					>
						{outcomeLabel(entry.outcome)} — {entry.tallyForWeight} agree · {entry.tallyAgainstWeight ??
							0} disagree
					</p>
				{/if}
			</div>
		{/each}
	{/if}

	{#if canAddQuestion}
		<form method="POST" action="?/addQuestion" use:enhance class="mt-5 border-t border-line pt-4">
			{#if form?.questionError}
				<Alert variant="error" class="mb-2">{form.questionError}</Alert>
			{/if}
			{#if form?.questionAdded}
				<Alert variant="success" class="mb-2">Question added.</Alert>
			{/if}
			<label for="mq-prompt" class="label">Add a question</label>
			<div class="flex gap-2">
				<input
					type="text"
					id="mq-prompt"
					name="prompt"
					required
					maxlength="280"
					class="input"
					placeholder="Propose another question for the group"
				/>
				<Button type="submit" variant="ghost" size="sm">Add</Button>
			</div>
		</form>
	{:else if questionNote}
		<p class="mt-5 border-t border-line pt-4 text-[13px] text-muted">{questionNote}</p>
	{/if}
</div>
