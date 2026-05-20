<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let choices = $state<string[]>(['', '']);
	let visibility = $state<'public' | 'community'>('public');

	const nowIso = new Date(Date.now() - new Date().getSeconds() * 1000).toISOString().slice(0, 16);
	const defaultEndTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

	$effect(() => {
		if (form?.choices?.length) {
			choices = [...form.choices];
		}
		if (form?.visibility === 'public' || form?.visibility === 'community') {
			visibility = form.visibility;
		}
	});

	function addChoice() {
		if (choices.length < 20) choices = [...choices, ''];
	}

	function removeChoice(index: number) {
		if (choices.length > 2) choices = choices.filter((_, i) => i !== index);
	}
</script>

<svelte:head>
	<title>New proposal — {data.community.name}</title>
</svelte:head>

<div class="page" style="max-width: 1100px;">
	<a href={resolve(`/communities/${data.community.slug}`)} class="breadcrumb">{data.community.name}</a>

	<header class="page-head">
		<div>
			<h1 class="page-title">Open a <em>proposal.</em></h1>
			<p class="page-sub">Write what's being decided. Add the options. Set when voting opens and closes.</p>
		</div>
	</header>

	{#if form?.error}
		<div class="alert alert-error" style="margin-bottom: 24px;">{form.error}</div>
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
					<label for="body" class="label">Context</label>
					<textarea
						id="body"
						name="body"
						required
						rows="14"
						class="textarea"
						placeholder="Why this is up for a vote, what each option means, anything members should know before deciding…"
						>{form?.body ?? ''}</textarea>
				</div>
			</div>

			<div class="form-stack">
				<div class="field">
					<span class="label">Who can see it</span>
					<div class="toggle-group">
						<label class="toggle-opt" class:selected={visibility === 'public'}>
							<input type="radio" name="visibility" value="public" bind:group={visibility} />
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
								<circle cx="12" cy="12" r="9" />
								<path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
							</svg>
							Public
						</label>
						<label class="toggle-opt" class:selected={visibility === 'community'}>
							<input type="radio" name="visibility" value="community" bind:group={visibility} />
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
								<rect x="4" y="11" width="16" height="10" rx="2" />
								<path d="M8 11V7a4 4 0 0 1 8 0v4" />
							</svg>
							Members
						</label>
					</div>
					<p class="hint">
						{visibility === 'public'
							? 'Anyone — even non-members — can read this proposal and see the result.'
							: 'Only people in this community can see it.'}
					</p>
				</div>

				<div class="field">
					<label for="startTime" class="label">Voting opens</label>
					<input
						type="datetime-local"
						id="startTime"
						name="startTime"
						required
						value={form?.startTime ?? nowIso}
						class="input"
					/>
				</div>

				<div class="field">
					<label for="endTime" class="label">Voting closes</label>
					<input
						type="datetime-local"
						id="endTime"
						name="endTime"
						required
						value={form?.endTime ?? defaultEndTime}
						class="input"
					/>
				</div>

				<div class="field">
					<span class="label">Choices <span class="label-optional">2–20</span></span>
					<div style="display: flex; flex-direction: column; gap: 8px;">
						{#each choices as _, i (i)}
							<div style="display: flex; gap: 8px;">
								<input
									type="text"
									name="choices"
									required
									maxlength="200"
									bind:value={choices[i]}
									class="input"
									placeholder="Option {i + 1}"
								/>
								{#if choices.length > 2}
									<button type="button" onclick={() => removeChoice(i)} class="btn btn-ghost btn-sm">
										Remove
									</button>
								{/if}
							</div>
						{/each}
					</div>
					{#if choices.length < 20}
						<button type="button" onclick={addChoice} class="btn btn-ghost btn-sm" style="align-self: start; margin-top: 8px;">
							+ Add a choice
						</button>
					{/if}
				</div>
			</div>
		</div>

		<div class="form-actions">
			<button type="submit" class="btn btn-accent btn-lg">Open proposal</button>
			<a href={resolve(`/communities/${data.community.slug}`)} class="btn btn-ghost btn-lg">Cancel</a>
		</div>
	</form>
</div>

<style>
	@media (min-width: 960px) {
		.proposal-grid {
			grid-template-columns: 1.4fr 1fr !important;
		}
	}
</style>
