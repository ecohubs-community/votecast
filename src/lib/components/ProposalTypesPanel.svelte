<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import MethodFlow from './MethodFlow.svelte';
	import Button from '$lib/components/Button.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import VoteCard from '$lib/components/VoteCard.svelte';
	import PageSub from '$lib/components/PageSub.svelte';

	type TypeSummary = {
		ballotModuleId: string;
		decisionRuleId: string;
		deliberationSeconds: number;
		objectionWindowSeconds: number;
		tallyReveal: 'live' | 'on-close' | 'hidden-forever';
		defaultChoices: string[] | null;
		defaultVisibility: 'public' | 'community';
		lockChoices: boolean;
		lockDeliberation: boolean;
		lockVoting: boolean;
		lockVisibility: boolean;
	};
	type TypeRow = {
		id: string;
		name: string;
		description: string;
		retired: boolean;
		hasProposals: boolean;
		summary: TypeSummary | null;
	};

	let {
		types,
		methodOptions,
		form
	}: {
		types: TypeRow[];
		methodOptions: ReadonlyArray<{ id: string; label: string }>;
		form: { typeError?: string; typeSuccess?: string; name?: string } | null;
	} = $props();

	let showRetired = $state(false);
	const visibleTypes = $derived(types.filter((t) => showRetired || !t.retired));

	// New-type form: the chosen method decides whether choices or question-contribution config applies.
	let methodOption = $state(untrack(() => methodOptions[0]?.id ?? ''));
	const isMultiQuestion = $derived(methodOption.startsWith('multi-question'));
	// Approval methods use a fixed Approve/Reject/Abstain ballot — no free-form choices to enter.
	const isApproval = $derived(methodOption.includes('approval'));
	// "Who may add questions" only matters once we allow additions during deliberation.
	let questionPhase = $state<'creation' | 'deliberation'>('creation');
</script>

<div class="mb-[18px] flex items-baseline justify-between gap-3">
	<h2
		class="m-0 font-display text-[length:var(--vc-text-xl)] leading-[1.2] font-normal tracking-[-0.01em] text-ink"
	>
		Proposal types
	</h2>
	<PageSub class="!mt-1">
		Types bundle a voting method, timings, and defaults. Editing a method makes a new version;
		existing proposals keep the version they were created with.
	</PageSub>
</div>

{#if form?.typeError}
	<Alert variant="error" class="mb-4">{form.typeError}</Alert>
{/if}
{#if form?.typeSuccess}
	<Alert variant="success" class="mb-4">{form.typeSuccess}</Alert>
{/if}

<div class="types-filter">
	<label class="check-inline">
		<input type="checkbox" bind:checked={showRetired} />
		Show retired
	</label>
</div>

<section class="types-list">
	{#each visibleTypes as t (t.id)}
		<div
			class="type-card rounded-[var(--vc-radius-xl)] border border-line bg-surface p-6 shadow-[var(--vc-shadow-xs)]"
		>
			<div class="type-main">
				<div class="type-head">
					<strong>{t.name}</strong>
					{#if t.retired}<span class="meta-pill">Retired</span>{/if}
				</div>
				{#if t.description}
					<PageSub class="!mt-1">{t.description}</PageSub>
				{/if}
				{#if t.summary}
					<MethodFlow
						ballotModuleId={t.summary.ballotModuleId}
						decisionRuleId={t.summary.decisionRuleId}
						deliberationSeconds={t.summary.deliberationSeconds}
						objectionWindowSeconds={t.summary.objectionWindowSeconds}
						tallyReveal={t.summary.tallyReveal}
					/>
					<p class="type-defaults">
						{#if t.summary.defaultChoices}
							Choices: {t.summary.defaultChoices.join(', ')}{t.summary.lockChoices ? ' 🔒' : ''} ·
						{/if}
						Visibility: {t.summary.defaultVisibility}{t.summary.lockVisibility ? ' 🔒' : ''}
						{#if t.summary.lockDeliberation || t.summary.lockVoting}
							· Timing 🔒
						{/if}
					</p>
				{/if}
			</div>

			<div class="type-actions">
				<form method="POST" action="?/retireType" use:enhance>
					<input type="hidden" name="typeId" value={t.id} />
					<input type="hidden" name="retired" value={t.retired ? 'false' : 'true'} />
					<Button type="submit" variant="ghost" size="sm">
						{t.retired ? 'Restore' : 'Retire'}
					</Button>
				</form>
				<form method="POST" action="?/deleteType" use:enhance>
					<input type="hidden" name="typeId" value={t.id} />
					<Button
						type="submit"
						variant="danger"
						size="sm"
						disabled={!t.retired || t.hasProposals}
						title={!t.retired
							? 'Retire the type before deleting it'
							: t.hasProposals
								? 'This type still has proposals and cannot be deleted'
								: 'Permanently delete this type'}
					>
						Delete
					</Button>
				</form>
			</div>
		</div>
	{/each}
	{#if visibleTypes.length === 0}
		<PageSub>No {showRetired ? '' : 'active '}types.</PageSub>
	{/if}
</section>

<VoteCard as="section" title="New type" titleAs="h3" class="mt-6">
	<form method="POST" action="?/createType" use:enhance class="form-stack">
		<div class="field">
			<label for="type-name" class="label">Name</label>
			<input
				type="text"
				id="type-name"
				name="name"
				required
				maxlength="80"
				class="input"
				value={form?.name ?? ''}
			/>
		</div>

		<div class="field">
			<label for="type-desc" class="label">
				Description <span class="label-optional">optional</span>
			</label>
			<input type="text" id="type-desc" name="description" maxlength="200" class="input" />
		</div>

		<div class="field">
			<label for="type-method" class="label">Method</label>
			<select id="type-method" name="methodOption" bind:value={methodOption} class="input">
				{#each methodOptions as opt (opt.id)}
					<option value={opt.id}>{opt.label}</option>
				{/each}
			</select>
		</div>

		<div class="field">
			<label for="type-reveal" class="label">When results are revealed</label>
			<select id="type-reveal" name="tallyReveal" class="input">
				<option value="on-close">After voting closes</option>
				<option value="live">Live, during voting</option>
				<option value="hidden-forever">Hidden (facilitators only)</option>
			</select>
		</div>

		<div class="grid-2">
			<div class="field">
				<label for="type-delib" class="label">Deliberation (days)</label>
				<input
					type="number"
					id="type-delib"
					name="deliberationDays"
					min="0"
					max="60"
					value="0"
					class="input"
				/>
				<p class="hint">Set by the type; proposers don't edit deliberation length.</p>
			</div>
			<div class="field">
				<label for="type-voting" class="label">Voting (days)</label>
				<input
					type="number"
					id="type-voting"
					name="votingDays"
					min="1"
					max="60"
					value="3"
					class="input"
				/>
				<label class="check-inline">
					<input type="checkbox" name="lockVoting" /> Lock — proposers can't change
				</label>
			</div>
		</div>

		<div class="field">
			<label for="type-visibility" class="label">Default visibility</label>
			<select id="type-visibility" name="defaultVisibility" class="input">
				<option value="community">Members only</option>
				<option value="public">Public</option>
			</select>
			<label class="check-inline">
				<input type="checkbox" name="lockVisibility" /> Lock — proposers can't change
			</label>
		</div>

		{#if isMultiQuestion}
			<div class="field">
				<label for="type-qphase" class="label">Questions can be added</label>
				<select
					id="type-qphase"
					name="questionContributionPhase"
					bind:value={questionPhase}
					class="input"
				>
					<option value="creation">Only at creation (the proposer sets them)</option>
					<option value="deliberation">During the deliberation phase</option>
				</select>

				{#if questionPhase === 'deliberation'}
					<label for="type-qwho" class="label mt-3">Who may add them</label>
					<select id="type-qwho" name="questionContributors" class="input">
						<option value="proposer">Proposer only</option>
						<option value="members">Any member</option>
					</select>
				{/if}

				<label class="check-inline">
					<input type="checkbox" name="lockQuestionContribution" /> Lock — proposers can't change
				</label>
				<p class="hint">
					“Only at creation” fixes the questions in the new-proposal form. “During the deliberation
					phase” also lets people propose more on the proposal page, until voting opens.
				</p>
			</div>
		{:else if isApproval}
			<div class="field">
				<span class="label">Ballot</span>
				<p class="hint">
					Approval votes use a fixed <strong>Approve / Reject / Abstain</strong> ballot.
				</p>
			</div>
		{:else}
			<div class="field">
				<label for="type-choices" class="label">
					Default choices <span class="label-optional">comma-separated, optional</span>
				</label>
				<input
					type="text"
					id="type-choices"
					name="defaultChoices"
					class="input"
					placeholder="For, Against, Abstain"
				/>
				<label class="check-inline">
					<input type="checkbox" name="lockChoices" /> Lock — proposers can't change
				</label>
			</div>
		{/if}

		<Button type="submit" variant="accent" class="self-start">Create type</Button>
	</form>
</VoteCard>

<style>
	.types-filter {
		margin-bottom: 16px;
	}
	.types-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.type-card {
		display: flex;
		align-items: flex-start;
		gap: 16px;
	}
	.type-main {
		flex: 1;
		min-width: 0;
	}
	.type-head {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.type-defaults {
		margin: 8px 0 0;
		font-size: 12px;
		color: var(--vc-muted);
	}
	.type-actions {
		display: flex;
		flex-direction: column;
		gap: 8px;
		flex-shrink: 0;
	}
	.check-inline {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 8px;
		font-size: 13px;
		color: var(--vc-ink-2);
	}
	.grid-2 {
		display: grid;
		gap: 12px;
		grid-template-columns: 1fr 1fr;
	}
</style>
