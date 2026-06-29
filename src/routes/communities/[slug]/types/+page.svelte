<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	function deliberationLabel(seconds: number): string {
		if (!seconds) return 'no deliberation';
		const days = Math.round(seconds / 86_400);
		return days >= 1 ? `${days}d deliberation` : `${Math.round(seconds / 3600)}h deliberation`;
	}
</script>

<svelte:head>
	<title>Proposal types — {data.community.name}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page">
	<a href={resolve(`/communities/${data.community.slug}/settings`)} class="breadcrumb">
		{data.community.name} settings
	</a>

	<header class="page-head">
		<div>
			<h1 class="page-title">Proposal <em>types.</em></h1>
			<p class="page-sub">
				Types bundle a voting method and a deliberation time. Editing a method creates a new
				version; existing proposals keep the version they were created with.
			</p>
		</div>
	</header>

	{#if form?.error}
		<div class="alert alert-error" style="margin-bottom: 24px;">{form.error}</div>
	{/if}
	{#if form?.created}
		<div class="alert alert-success" style="margin-bottom: 24px;">Type created.</div>
	{/if}
	{#if form?.updated}
		<div class="alert alert-success" style="margin-bottom: 24px;">Type updated.</div>
	{/if}

	<section style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 40px;">
		{#each data.types as t (t.id)}
			<div class="vote-card" style="display: flex; align-items: center; gap: 16px;">
				<div style="flex: 1;">
					<div style="display: flex; align-items: center; gap: 10px;">
						<strong>{t.name}</strong>
						{#if t.retired}
							<span class="meta-pill">Retired</span>
						{/if}
					</div>
					{#if t.description}
						<p class="page-sub" style="margin: 4px 0 0;">{t.description}</p>
					{/if}
					{#if t.summary}
						<p class="hint" style="margin: 6px 0 0;">
							{t.summary.ballotModuleId} · {t.summary.decisionRuleId} ·
							{deliberationLabel(t.summary.deliberationSeconds)}
						</p>
					{/if}
				</div>
				<form method="POST" action="?/retire" use:enhance>
					<input type="hidden" name="typeId" value={t.id} />
					<input type="hidden" name="retired" value={t.retired ? 'false' : 'true'} />
					<button type="submit" class="btn btn-ghost btn-sm">
						{t.retired ? 'Restore' : 'Retire'}
					</button>
				</form>
			</div>
		{/each}
	</section>

	<section class="vote-card">
		<div class="vote-card-head">
			<h2 class="vote-card-title">New type</h2>
		</div>

		<form method="POST" action="?/create" use:enhance class="form-stack">
			<div class="field">
				<label for="name" class="label">Name</label>
				<input
					type="text"
					id="name"
					name="name"
					required
					maxlength="80"
					class="input"
					value={form?.name ?? ''}
				/>
			</div>

			<div class="field">
				<label for="description" class="label"
					>Description <span class="label-optional">optional</span></label
				>
				<input type="text" id="description" name="description" maxlength="200" class="input" />
			</div>

			<div class="field">
				<label for="methodOption" class="label">Method</label>
				<select id="methodOption" name="methodOption" class="input">
					{#each data.methodOptions as opt (opt.id)}
						<option value={opt.id}>{opt.label}</option>
					{/each}
				</select>
			</div>

			<div class="field">
				<label for="tallyReveal" class="label">When results are revealed</label>
				<select id="tallyReveal" name="tallyReveal" class="input">
					<option value="on-close">After voting closes</option>
					<option value="live">Live, during voting</option>
					<option value="hidden-forever">Hidden (facilitators only)</option>
				</select>
			</div>

			<div class="field" style="max-width: 200px;">
				<label for="deliberationDays" class="label">Deliberation (days)</label>
				<input
					type="number"
					id="deliberationDays"
					name="deliberationDays"
					min="0"
					max="60"
					value="0"
					class="input"
				/>
			</div>

			<button type="submit" class="btn btn-accent" style="align-self: start;">Create type</button>
		</form>
	</section>
</div>
