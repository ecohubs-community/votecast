<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let name = $state('');
	let slug = $state('');
	let slugManuallyEdited = $state(false);
	let visibility = $state<'public' | 'community'>('public');

	$effect(() => {
		if (form) {
			name = form.name ?? '';
			slug = form.slug ?? '';
			if (form.visibility === 'community' || form.visibility === 'public') {
				visibility = form.visibility;
			}
		}
	});

	function generateSlug(value: string): string {
		return value
			.toLowerCase()
			.trim()
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9-]/g, '')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 60);
	}

	function handleNameInput() {
		if (!slugManuallyEdited) {
			slug = generateSlug(name);
		}
	}

	function handleSlugInput() {
		slugManuallyEdited = true;
	}
</script>

<svelte:head>
	<title>Start a community — VoteCast</title>
</svelte:head>

<div class="page" style="max-width: 720px;">
	<a href={resolve('/')} class="breadcrumb">Home</a>

	<header class="page-head">
		<div>
			<h1 class="page-title">Start <em>something.</em></h1>
			<p class="page-sub">Give your group a place to propose, deliberate, and decide together.</p>
		</div>
	</header>

	{#if form?.error}
		<div class="alert alert-error" style="margin-bottom: 24px;">{form.error}</div>
	{/if}

	<form method="POST" use:enhance class="form-stack">
		<div class="field">
			<label for="name" class="label">Name</label>
			<input
				type="text"
				id="name"
				name="name"
				required
				maxlength="100"
				bind:value={name}
				oninput={handleNameInput}
				class="input"
				placeholder="Willow Creek Co-op"
			/>
		</div>

		<div class="field">
			<label for="slug" class="label">URL</label>
			<input
				type="text"
				id="slug"
				name="slug"
				required
				minlength="2"
				maxlength="60"
				pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
				bind:value={slug}
				oninput={handleSlugInput}
				class="input"
				placeholder="willow-creek"
			/>
			<p class="hint">
				Lowercase letters, numbers, and hyphens. Lives at
				<span style="font-family: var(--vc-font-mono); color: var(--vc-ink-2);">/communities/{slug || '…'}</span>
			</p>
		</div>

		<div class="field">
			<label for="description" class="label">
				About the community<span class="label-optional">optional</span>
			</label>
			<textarea
				id="description"
				name="description"
				rows="4"
				maxlength="2000"
				class="textarea"
				placeholder="A short, friendly line or two so newcomers know who you are.">{form?.description ?? ''}</textarea>
		</div>

		<div class="field">
			<span class="label">Who can see it</span>
			<div class="radio-stack">
				<label class="radio-row" class:selected={visibility === 'public'}>
					<input type="radio" name="visibility" value="public" bind:group={visibility} />
					<span>
						<span class="radio-label">Public</span>
						<span class="radio-desc">Anyone can find and read this community.</span>
					</span>
				</label>
				<label class="radio-row" class:selected={visibility === 'community'}>
					<input type="radio" name="visibility" value="community" bind:group={visibility} />
					<span>
						<span class="radio-label">Members only</span>
						<span class="radio-desc">Only people you invite can see what's happening here.</span>
					</span>
				</label>
			</div>
		</div>

		<div class="form-actions">
			<button type="submit" class="btn btn-accent btn-lg">Create community</button>
			<a href={resolve('/')} class="btn btn-ghost btn-lg">Cancel</a>
		</div>
	</form>
</div>
