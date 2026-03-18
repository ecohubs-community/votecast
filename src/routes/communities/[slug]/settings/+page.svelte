<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { formatRelativeTime } from '$lib/utils/format';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let activeTab = $state<'general' | 'members' | 'webhooks' | 'danger'>('general');

	// ─── General tab state ─────────────────────────────────────────────────────
	let communityVisibility = $state<'public' | 'community'>('public');

	// Sync from data on load / after navigation
	$effect(() => {
		communityVisibility = data.community.visibility as 'public' | 'community';
	});

	// ─── Danger zone state ─────────────────────────────────────────────────────
	let showDeleteConfirm = $state(false);
	let confirmName = $state('');

	// ─── Webhooks tab state ────────────────────────────────────────────────────
	let webhooks = $state<typeof data.webhooks>([]);

	$effect(() => {
		webhooks = data.webhooks;
	});
	let newWebhookUrl = $state('');
	let newWebhookEvents = $state<string[]>([]);
	let webhookError = $state('');
	let webhookSecret = $state<string | null>(null);
	let webhookLoading = $state(false);

	const availableEvents = [
		{ value: 'community.created', label: 'Community Created' },
		{ value: 'member.joined', label: 'Member Joined' },
		{ value: 'proposal.created', label: 'Proposal Created' },
		{ value: 'proposal.started', label: 'Proposal Started' },
		{ value: 'vote.cast', label: 'Vote Cast' },
		{ value: 'proposal.closed', label: 'Proposal Closed' }
	];

	// ─── Member helpers ────────────────────────────────────────────────────────
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

	// ─── Webhook actions ───────────────────────────────────────────────────────
	async function addWebhook(e: SubmitEvent) {
		e.preventDefault();
		webhookError = '';
		webhookSecret = null;

		if (!newWebhookUrl.trim()) {
			webhookError = 'URL is required';
			return;
		}
		if (newWebhookEvents.length === 0) {
			webhookError = 'Select at least one event';
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
				webhookError = json.error?.message || 'Failed to create webhook';
				return;
			}

			webhookSecret = json.data.secret;
			newWebhookUrl = '';
			newWebhookEvents = [];
			await invalidateAll();
			webhooks = data.webhooks;
		} catch {
			webhookError = 'Network error';
		} finally {
			webhookLoading = false;
		}
	}

	async function deleteWebhook(webhookId: string) {
		try {
			await fetch(`/api/communities/${data.community.id}/webhooks/${webhookId}`, {
				method: 'DELETE'
			});
			webhooks = webhooks.filter((w) => w.id !== webhookId);
		} catch {
			// silently fail
		}
	}

	async function toggleWebhook(webhookId: string, active: boolean) {
		try {
			await fetch(`/api/communities/${data.community.id}/webhooks/${webhookId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ active })
			});
			webhooks = webhooks.map((w) => (w.id === webhookId ? { ...w, active } : w));
		} catch {
			// silently fail
		}
	}

	function toggleEvent(event: string) {
		if (newWebhookEvents.includes(event)) {
			newWebhookEvents = newWebhookEvents.filter((e) => e !== event);
		} else {
			newWebhookEvents = [...newWebhookEvents, event];
		}
	}
</script>

<svelte:head>
	<title>Settings — {data.community.name} — LumiVote</title>
</svelte:head>

<!-- Breadcrumb -->
<div class="mb-6">
	<a
		href="/communities/{data.community.slug}"
		class="text-sm text-blue-600 hover:text-blue-800"
	>
		&larr; Back to {data.community.name}
	</a>
</div>

<h1 class="text-2xl font-bold text-gray-900 sm:text-3xl">Community Settings</h1>
<p class="mt-1 text-sm text-gray-600">{data.community.name}</p>

<!-- Tab navigation -->
<nav class="mt-6 flex gap-1 border-b border-gray-200">
	{#each [
		{ id: 'general', label: 'General' },
		{ id: 'members', label: `Members (${data.members.items.length})` },
		{ id: 'webhooks', label: `Webhooks (${webhooks.length})` },
		{ id: 'danger', label: 'Danger Zone' }
	] as tab}
		<button
			onclick={() => (activeTab = tab.id as typeof activeTab)}
			class="px-4 py-2.5 text-sm font-medium transition-colors
				{activeTab === tab.id
				? 'border-b-2 border-blue-500 text-blue-600'
				: 'text-gray-500 hover:text-gray-700'}"
		>
			{tab.label}
		</button>
	{/each}
</nav>

<div class="mt-6">
	<!-- ═══════════════════════════════════════════════════════════════════════════ -->
	<!-- GENERAL TAB                                                               -->
	<!-- ═══════════════════════════════════════════════════════════════════════════ -->
	{#if activeTab === 'general'}
		{#if form?.generalSuccess}
			<div class="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
				Settings saved successfully.
			</div>
		{/if}
		{#if form?.generalError}
			<div class="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
				{form.generalError}
			</div>
		{/if}

		<form method="POST" action="?/updateGeneral" use:enhance class="max-w-2xl space-y-6">
			<!-- Name -->
			<div>
				<label for="name" class="block text-sm font-medium text-gray-700">Community Name</label>
				<input
					type="text"
					id="name"
					name="name"
					required
					maxlength="100"
					value={data.community.name}
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				/>
			</div>

			<!-- Description -->
			<div>
				<label for="description" class="block text-sm font-medium text-gray-700">Description</label>
				<textarea
					id="description"
					name="description"
					rows="4"
					maxlength="2000"
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				>{data.community.description}</textarea>
			</div>

			<!-- Visibility -->
			<div>
				<span class="block text-sm font-medium text-gray-700">Community Visibility</span>
				<div class="mt-2 flex gap-2">
					<label
						class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors
						{communityVisibility === 'public'
							? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
							: 'border-gray-200 text-gray-600 hover:bg-gray-50'}"
					>
						<input type="radio" name="visibility" value="public" bind:group={communityVisibility} class="sr-only" />
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.466.732-3.558" />
						</svg>
						Public
					</label>
					<label
						class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors
						{communityVisibility === 'community'
							? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
							: 'border-gray-200 text-gray-600 hover:bg-gray-50'}"
					>
						<input type="radio" name="visibility" value="community" bind:group={communityVisibility} class="sr-only" />
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
						</svg>
						Community Only
					</label>
				</div>
				<p class="mt-1.5 text-xs text-gray-400">
					{communityVisibility === 'public'
						? 'Anyone can discover and view this community.'
						: 'Only members can view this community.'}
				</p>
			</div>

			<!-- Slug (read-only) -->
			<div>
				<span class="block text-sm font-medium text-gray-700">Slug</span>
				<div class="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
					{data.community.slug}
				</div>
				<p class="mt-1 text-xs text-gray-400">The URL slug cannot be changed after creation.</p>
			</div>

			<div class="pt-2">
				<button
					type="submit"
					class="rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
				>
					Save Changes
				</button>
			</div>
		</form>

	<!-- ═══════════════════════════════════════════════════════════════════════════ -->
	<!-- MEMBERS TAB                                                               -->
	<!-- ═══════════════════════════════════════════════════════════════════════════ -->
	{:else if activeTab === 'members'}
		{#if form?.memberSuccess}
			<div class="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
				Member updated successfully.
			</div>
		{/if}
		{#if form?.memberError}
			<div class="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
				{form.memberError}
			</div>
		{/if}

		<p class="mb-4 text-sm text-gray-500">
			{data.members.items.length} member{data.members.items.length === 1 ? '' : 's'}
		</p>

		<div class="divide-y divide-gray-100">
			{#each data.members.items as member}
				<div class="flex items-center gap-4 py-3">
					<!-- Avatar -->
					<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
						{memberInitials(member)}
					</div>

					<!-- Info -->
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="truncate text-sm font-medium text-gray-900">
								{memberDisplayName(member)}
							</span>
							{#if member.role === 'admin'}
								<span class="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">Admin</span>
							{/if}
							{#if member.userId === data.user?.id}
								<span class="text-xs text-gray-400">(you)</span>
							{/if}
						</div>
						{#if member.walletAddress}
							<p class="text-xs text-gray-400">{shortenWallet(member.walletAddress)}</p>
						{/if}
						<p class="text-xs text-gray-400">
							Joined {formatRelativeTime(member.joinedAt)} · {member.voteCount} vote{member.voteCount === 1 ? '' : 's'}
						</p>
					</div>

					<!-- Actions (not for self) -->
					{#if member.userId !== data.user?.id}
						<div class="flex shrink-0 items-center gap-2">
							<form method="POST" action="?/updateRole" use:enhance>
								<input type="hidden" name="userId" value={member.userId} />
								<input type="hidden" name="role" value={member.role === 'admin' ? 'member' : 'admin'} />
								<button
									type="submit"
									class="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
								>
									{member.role === 'admin' ? 'Demote' : 'Promote'}
								</button>
							</form>
							<form method="POST" action="?/removeMember" use:enhance>
								<input type="hidden" name="userId" value={member.userId} />
								<button
									type="submit"
									class="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
								>
									Remove
								</button>
							</form>
						</div>
					{/if}
				</div>
			{/each}
		</div>

	<!-- ═══════════════════════════════════════════════════════════════════════════ -->
	<!-- WEBHOOKS TAB                                                              -->
	<!-- ═══════════════════════════════════════════════════════════════════════════ -->
	{:else if activeTab === 'webhooks'}
		<!-- Webhook secret banner (shown once after creation) -->
		{#if webhookSecret}
			<div class="mb-4 rounded-md border border-yellow-200 bg-yellow-50 p-4">
				<p class="text-sm font-medium text-yellow-800">Webhook created! Save this secret — it won't be shown again:</p>
				<code class="mt-1 block rounded bg-yellow-100 px-3 py-2 font-mono text-sm text-yellow-900 select-all">
					{webhookSecret}
				</code>
				<button
					onclick={() => (webhookSecret = null)}
					class="mt-2 text-xs text-yellow-700 underline hover:text-yellow-900"
				>
					Dismiss
				</button>
			</div>
		{/if}

		<!-- Existing webhooks -->
		{#if webhooks.length > 0}
			<div class="space-y-3">
				{#each webhooks as wh}
					<div class="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4">
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-gray-900">{wh.url}</p>
							<p class="mt-1 text-xs text-gray-500">
								Events: {wh.events.join(', ')}
							</p>
							<p class="text-xs text-gray-400">
								Created {formatRelativeTime(wh.createdAt)}
							</p>
						</div>
						<div class="flex shrink-0 items-center gap-2">
							<button
								onclick={() => toggleWebhook(wh.id, !wh.active)}
								class="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors
									{wh.active
									? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
									: 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'}"
							>
								{wh.active ? 'Active' : 'Paused'}
							</button>
							<button
								onclick={() => deleteWebhook(wh.id)}
								class="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
							>
								Delete
							</button>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-gray-500">No webhooks configured yet.</p>
		{/if}

		<!-- Add webhook form -->
		<div class="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
			<h3 class="text-sm font-semibold text-gray-900">Add Webhook</h3>

			{#if webhookError}
				<div class="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{webhookError}
				</div>
			{/if}

			<form onsubmit={addWebhook} class="mt-3 space-y-4">
				<div>
					<label for="webhook-url" class="block text-xs font-medium text-gray-600">Endpoint URL</label>
					<input
						type="url"
						id="webhook-url"
						required
						bind:value={newWebhookUrl}
						placeholder="https://example.com/webhook"
						class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					/>
				</div>

				<div>
					<span class="block text-xs font-medium text-gray-600">Events</span>
					<div class="mt-2 flex flex-wrap gap-2">
						{#each availableEvents as evt}
							<label
								class="flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors
									{newWebhookEvents.includes(evt.value)
									? 'border-blue-500 bg-blue-50 text-blue-700'
									: 'border-gray-200 text-gray-600 hover:bg-gray-50'}"
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

				<button
					type="submit"
					disabled={webhookLoading}
					class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
				>
					{webhookLoading ? 'Adding...' : 'Add Webhook'}
				</button>
			</form>
		</div>

	<!-- ═══════════════════════════════════════════════════════════════════════════ -->
	<!-- DANGER ZONE                                                               -->
	<!-- ═══════════════════════════════════════════════════════════════════════════ -->
	{:else if activeTab === 'danger'}
		{#if form?.dangerError}
			<div class="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
				{form.dangerError}
			</div>
		{/if}

		<div class="max-w-2xl rounded-lg border-2 border-red-200 p-6">
			<h3 class="text-lg font-semibold text-red-900">Delete Community</h3>
			<p class="mt-2 text-sm text-gray-600">
				Permanently delete <strong>{data.community.name}</strong> and all its proposals, votes,
				members, webhooks, and invites. This action cannot be undone.
			</p>

			{#if !showDeleteConfirm}
				<button
					onclick={() => (showDeleteConfirm = true)}
					class="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
				>
					Delete this community
				</button>
			{:else}
				<div class="mt-4 rounded-md border border-red-300 bg-red-50 p-4">
					<p class="text-sm font-medium text-red-800">
						Type <strong>{data.community.name}</strong> to confirm:
					</p>
					<input
						type="text"
						bind:value={confirmName}
						placeholder={data.community.name}
						class="mt-2 block w-full rounded-md border border-red-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
					/>
					<div class="mt-3 flex gap-3">
						<form method="POST" action="?/deleteCommunity" use:enhance>
							<button
								type="submit"
								disabled={confirmName !== data.community.name}
								class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
							>
								I understand, delete this community
							</button>
						</form>
						<button
							onclick={() => {
								showDeleteConfirm = false;
								confirmName = '';
							}}
							class="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
						>
							Cancel
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
