<script lang="ts">
	import { enhance } from '$app/forms';
	import Spinner from '$lib/components/Spinner.svelte';
	import { invalidateAll } from '$app/navigation';
	import { formatRelativeTime } from '$lib/utils/format';
	import { resolve } from '$app/paths';
	import ProposalTypesPanel from '$lib/components/ProposalTypesPanel.svelte';
	import VisibilityToggle from '$lib/components/VisibilityToggle.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let activeTab = $state<'general' | 'types' | 'members' | 'webhooks' | 'danger'>('general');

	let communityVisibility = $derived(data.community.visibility as 'public' | 'community');

	let showDeleteConfirm = $state(false);
	let confirmName = $state('');

	let webhooks = $derived(data.webhooks);
	let newWebhookUrl = $state('');
	let newWebhookEvents = $state<string[]>([]);
	let webhookError = $state('');
	let webhookSecret = $state<string | null>(null);
	let webhookLoading = $state(false);

	const availableEvents = [
		{ value: 'community.created', label: 'Community created' },
		{ value: 'member.joined', label: 'Member joined' },
		{ value: 'proposal.created', label: 'Proposal created' },
		{ value: 'proposal.started', label: 'Proposal opens' },
		{ value: 'vote.cast', label: 'Vote cast' },
		{ value: 'proposal.closed', label: 'Proposal closes' }
	];

	function shortenWallet(addr: string | null): string | null {
		if (!addr) return null;
		return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
	}

	function memberDisplayName(m: {
		displayName: string | null;
		name: string;
		walletAddress: string | null;
	}): string {
		if (m.displayName) return m.displayName;
		if (m.name && /^0x[0-9a-fA-F]{10,}$/.test(m.name)) {
			return shortenWallet(m.name) ?? m.name;
		}
		return m.name;
	}

	function memberInitials(m: {
		displayName: string | null;
		name: string;
		walletAddress: string | null;
	}): string {
		if (m.displayName) {
			const parts = m.displayName.trim().split(/\s+/);
			if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
			return m.displayName.slice(0, 2).toUpperCase();
		}
		if (/^0x[0-9a-fA-F]/.test(m.name)) {
			return (m.walletAddress ?? m.name).slice(2, 4).toUpperCase();
		}
		const parts = m.name.trim().split(/\s+/);
		if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
		return m.name.slice(0, 2).toUpperCase();
	}

	async function addWebhook(e: SubmitEvent) {
		e.preventDefault();
		webhookError = '';
		webhookSecret = null;

		if (!newWebhookUrl.trim()) {
			webhookError = 'Add a URL we should call.';
			return;
		}
		if (newWebhookEvents.length === 0) {
			webhookError = 'Pick at least one event to listen for.';
			return;
		}

		webhookLoading = true;
		try {
			const res = await fetch(`/api/communities/${data.community.id}/webhooks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: newWebhookUrl, events: newWebhookEvents })
			});
			const json = await res.json();

			if (!res.ok) {
				webhookError = json.error?.message || "Couldn't create the webhook.";
				return;
			}

			webhookSecret = json.data.secret;
			newWebhookUrl = '';
			newWebhookEvents = [];
			await invalidateAll();
			webhooks = data.webhooks;
		} catch {
			webhookError = 'Network error — try again.';
		} finally {
			webhookLoading = false;
		}
	}

	async function deleteWebhook(webhookId: string) {
		webhookError = '';
		try {
			const res = await fetch(`/api/communities/${data.community.id}/webhooks/${webhookId}`, {
				method: 'DELETE'
			});
			if (!res.ok) throw new Error('request failed');
			webhooks = webhooks.filter((w) => w.id !== webhookId);
		} catch {
			webhookError = 'Could not delete that webhook — try again.';
		}
	}

	async function toggleWebhook(webhookId: string, active: boolean) {
		webhookError = '';
		try {
			const res = await fetch(`/api/communities/${data.community.id}/webhooks/${webhookId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ active })
			});
			if (!res.ok) throw new Error('request failed');
			webhooks = webhooks.map((w) => (w.id === webhookId ? { ...w, active } : w));
		} catch {
			webhookError = 'Could not update that webhook — try again.';
		}
	}

	function toggleEvent(event: string) {
		newWebhookEvents = newWebhookEvents.includes(event)
			? newWebhookEvents.filter((e) => e !== event)
			: [...newWebhookEvents, event];
	}
</script>

<svelte:head>
	<title>Settings — {data.community.name}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page">
	<a href={resolve(`/communities/${data.community.slug}`)} class="breadcrumb"
		>{data.community.name}</a
	>

	<header class="page-head">
		<div>
			<h1 class="page-title">Settings</h1>
			<p class="page-sub">{data.community.name}</p>
		</div>
	</header>

	<nav class="tabs">
		<button
			class="tab"
			class:active={activeTab === 'general'}
			onclick={() => (activeTab = 'general')}
		>
			General
		</button>
		<button class="tab" class:active={activeTab === 'types'} onclick={() => (activeTab = 'types')}>
			Proposal types <span style="color: var(--vc-muted);">·</span>
			{data.types.length}
		</button>
		<button
			class="tab"
			class:active={activeTab === 'members'}
			onclick={() => (activeTab = 'members')}
		>
			Members <span style="color: var(--vc-muted);">·</span>
			{data.members.items.length}
		</button>
		<button
			class="tab"
			class:active={activeTab === 'webhooks'}
			onclick={() => (activeTab = 'webhooks')}
		>
			Webhooks <span style="color: var(--vc-muted);">·</span>
			{webhooks.length}
		</button>
		<button
			class="tab"
			class:active={activeTab === 'danger'}
			onclick={() => (activeTab = 'danger')}
			style="color: oklch(0.5 0.14 28);"
		>
			Danger zone
		</button>
	</nav>

	{#if activeTab === 'general'}
		{#if form?.generalSuccess}
			<div class="alert alert-success" style="margin-bottom: 20px;">Saved.</div>
		{/if}
		{#if form?.generalError}
			<div class="alert alert-error" style="margin-bottom: 20px;">{form.generalError}</div>
		{/if}

		<form method="POST" action="?/updateGeneral" use:enhance class="form-stack">
			<div class="field">
				<label for="name" class="label">Name</label>
				<input
					type="text"
					id="name"
					name="name"
					required
					maxlength="100"
					value={data.community.name}
					class="input"
				/>
			</div>

			<div class="field">
				<label for="description" class="label">About</label>
				<textarea id="description" name="description" rows="4" maxlength="2000" class="textarea"
					>{data.community.description}</textarea
				>
			</div>

			<div class="field">
				<span class="label">Who can see this community</span>
				<VisibilityToggle bind:value={communityVisibility} memberLabel="Members only" />
				<p class="hint">
					{communityVisibility === 'public'
						? 'Anyone can find and read this community.'
						: 'Only people you invite can see what happens here.'}
				</p>
			</div>

			<div class="field">
				<span class="label">URL</span>
				<div class="input-readonly">{data.community.slug}</div>
				<p class="hint">The URL is set once at creation — it doesn't change.</p>
			</div>

			<div class="form-actions">
				<button type="submit" class="btn btn-accent">Save changes</button>
			</div>
		</form>
	{:else if activeTab === 'types'}
		<ProposalTypesPanel types={data.types} methodOptions={data.methodOptions} {form} />
	{:else if activeTab === 'members'}
		{#if form?.memberSuccess}
			<div class="alert alert-success" style="margin-bottom: 20px;">Updated.</div>
		{/if}
		{#if form?.memberError}
			<div class="alert alert-error" style="margin-bottom: 20px;">{form.memberError}</div>
		{/if}

		<p class="hint" style="margin-bottom: 16px;">
			{data.members.items.length} member{data.members.items.length === 1 ? '' : 's'} in this community.
		</p>

		<div>
			{#each data.members.items as member (member.userId)}
				<div class="member-row">
					<div class="member-avatar" class:admin={member.role === 'admin'}>
						{memberInitials(member)}
					</div>

					<div class="member-info">
						<div class="member-name">
							<span>{memberDisplayName(member)}</span>
							{#if member.role === 'admin'}
								<span
									class="meta-pill"
									style="background: var(--vc-accent-soft); color: var(--vc-accent-ink);"
								>
									Admin
								</span>
							{/if}
							{#if member.userId === data.user?.id}
								<span style="color: var(--vc-muted); font-size: 12px; font-weight: 400;">(you)</span
								>
							{/if}
						</div>
						<div class="member-meta">
							{#if member.walletAddress}
								<span>{shortenWallet(member.walletAddress)}</span>
							{/if}
							<span>Joined {formatRelativeTime(member.joinedAt)}</span>
							<span>{member.voteCount} {member.voteCount === 1 ? 'vote' : 'votes'}</span>
						</div>
					</div>

					{#if member.userId !== data.user?.id}
						<div class="member-actions">
							<form method="POST" action="?/updateRole" use:enhance>
								<input type="hidden" name="userId" value={member.userId} />
								<input
									type="hidden"
									name="role"
									value={member.role === 'admin' ? 'member' : 'admin'}
								/>
								<button type="submit" class="btn btn-ghost btn-sm">
									{member.role === 'admin' ? 'Demote' : 'Promote'}
								</button>
							</form>
							<form method="POST" action="?/removeMember" use:enhance>
								<input type="hidden" name="userId" value={member.userId} />
								<button type="submit" class="btn btn-danger btn-sm">Remove</button>
							</form>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else if activeTab === 'webhooks'}
		{#if webhookSecret}
			<div class="alert alert-warn" style="margin-bottom: 20px;">
				<p style="margin: 0 0 8px; font-weight: 500;">
					Webhook ready — copy the secret now. We won't show it again.
				</p>
				<code
					style="display: block; padding: 10px 12px; background: rgba(0,0,0,0.05); border-radius: 8px; font-family: var(--vc-font-mono); font-size: 13px; user-select: all;"
				>
					{webhookSecret}
				</code>
				<button
					onclick={() => (webhookSecret = null)}
					class="btn btn-ghost btn-sm"
					style="margin-top: 12px;"
				>
					Dismiss
				</button>
			</div>
		{/if}

		{#if webhooks.length > 0}
			<div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px;">
				{#each webhooks as wh (wh.id)}
					<div class="vote-card" style="padding: 18px 20px;">
						<div
							style="display: flex; gap: 16px; align-items: start; justify-content: space-between;"
						>
							<div style="min-width: 0; flex: 1;">
								<p
									style="margin: 0; font-family: var(--vc-font-mono); font-size: 13px; color: var(--vc-ink); word-break: break-all;"
								>
									{wh.url}
								</p>
								<p class="hint" style="margin-top: 6px;">Events: {wh.events.join(', ')}</p>
								<p class="hint" style="margin-top: 2px;">
									Created {formatRelativeTime(wh.createdAt)}
								</p>
							</div>
							<div style="display: flex; gap: 8px; flex-shrink: 0;">
								<button
									onclick={() => toggleWebhook(wh.id, !wh.active)}
									class="btn btn-ghost btn-sm"
									aria-pressed={wh.active}
									aria-label="Toggle webhook {wh.active ? 'off' : 'on'}"
								>
									{wh.active ? 'Active' : 'Paused'}
								</button>
								<button onclick={() => deleteWebhook(wh.id)} class="btn btn-danger btn-sm"
									>Delete</button
								>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="empty" style="margin-bottom: 28px;">
				<p>No webhooks yet. Add one below to forward events to your tools.</p>
			</div>
		{/if}

		<div class="vote-card">
			<div class="vote-card-head">
				<h3 class="vote-card-title">Add a webhook</h3>
			</div>

			{#if webhookError}
				<div class="alert alert-error" style="margin-bottom: 16px;">{webhookError}</div>
			{/if}

			<form onsubmit={addWebhook} class="form-stack">
				<div class="field">
					<label for="webhook-url" class="label">Endpoint URL</label>
					<input
						type="url"
						id="webhook-url"
						required
						bind:value={newWebhookUrl}
						placeholder="https://example.com/webhook"
						class="input"
					/>
				</div>

				<div class="field">
					<span class="label">Events</span>
					<div style="display: flex; flex-wrap: wrap; gap: 8px;">
						{#each availableEvents as evt (evt.value)}
							<label
								class="inline-flex cursor-pointer items-center rounded-full border bg-surface px-3 py-1.5 text-[12px] font-medium transition-[border-color,background,color] duration-[var(--vc-duration-fast)] ease-[var(--vc-ease)] {newWebhookEvents.includes(
									evt.value
								)
									? 'border-accent bg-accent-soft text-accent-ink'
									: 'border-line text-ink-2 hover:border-line-2'}"
							>
								<input
									type="checkbox"
									checked={newWebhookEvents.includes(evt.value)}
									onchange={() => toggleEvent(evt.value)}
									class="sr-only"
								/>
								{evt.label}
							</label>
						{/each}
					</div>
				</div>

				<div>
					<button type="submit" disabled={webhookLoading} class="btn btn-accent">
						{#if webhookLoading}
							<Spinner /> Adding…
						{:else}
							Add webhook
						{/if}
					</button>
				</div>
			</form>
		</div>
	{:else if activeTab === 'danger'}
		{#if form?.dangerError}
			<div class="alert alert-error" style="margin-bottom: 20px;">{form.dangerError}</div>
		{/if}

		<div class="rounded-[var(--vc-radius-xl)] border border-danger-line bg-danger-bg p-6">
			<h3 class="m-0 font-display text-[length:var(--vc-text-xl)] font-normal text-danger-strong">
				Delete this community
			</h3>
			<p style="margin-top: 8px; color: var(--vc-ink-2); font-size: 14px; line-height: 1.55;">
				This permanently removes <strong>{data.community.name}</strong> along with every proposal, vote,
				member, webhook, and invite. There's no coming back from this.
			</p>

			{#if !showDeleteConfirm}
				<button
					onclick={() => (showDeleteConfirm = true)}
					class="btn btn-destructive"
					style="margin-top: 20px;"
				>
					Delete community
				</button>
			{:else}
				<div
					style="margin-top: 20px; padding: 16px; border: 1px solid oklch(0.55 0.16 28 / 0.4); border-radius: 12px; background: oklch(0.55 0.16 28 / 0.06);"
				>
					<p style="margin: 0 0 10px; font-size: 14px; color: oklch(0.4 0.16 28);">
						Type <strong>{data.community.name}</strong> to confirm.
					</p>
					<input
						type="text"
						bind:value={confirmName}
						placeholder={data.community.name}
						class="input"
						style="border-color: oklch(0.55 0.16 28 / 0.3);"
					/>
					<div style="margin-top: 14px; display: flex; gap: 10px;">
						<form method="POST" action="?/deleteCommunity" use:enhance>
							<button
								type="submit"
								disabled={confirmName !== data.community.name}
								class="btn btn-destructive"
							>
								I understand — delete it
							</button>
						</form>
						<button
							onclick={() => {
								showDeleteConfirm = false;
								confirmName = '';
							}}
							class="btn btn-ghost"
						>
							Cancel
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
