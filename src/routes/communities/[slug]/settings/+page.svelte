<script lang="ts">
	import { enhance } from '$app/forms';
	import Spinner from '$lib/components/Spinner.svelte';
	import { invalidateAll } from '$app/navigation';
	import { formatRelativeTime } from '$lib/utils/format';
	import { resolve } from '$app/paths';
	import ProposalTypesPanel from '$lib/components/ProposalTypesPanel.svelte';
	import VisibilityToggle from '$lib/components/VisibilityToggle.svelte';
	import Button from '$lib/components/Button.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import Tab from '$lib/components/Tab.svelte';
	import VoteCard from '$lib/components/VoteCard.svelte';
	import MemberRow from '$lib/components/MemberRow.svelte';
	import Page from '$lib/components/Page.svelte';
	import PageHead from '$lib/components/PageHead.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import PageSub from '$lib/components/PageSub.svelte';
	import Breadcrumb from '$lib/components/Breadcrumb.svelte';
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

<Page>
	<Breadcrumb href={resolve(`/communities/${data.community.slug}`)}
		>{data.community.name}</Breadcrumb
	>

	<PageHead>
		<div>
			<PageTitle>Settings</PageTitle>
			<PageSub>{data.community.name}</PageSub>
		</div>
	</PageHead>

	<Tabs>
		<Tab active={activeTab === 'general'} onclick={() => (activeTab = 'general')}>General</Tab>
		<Tab active={activeTab === 'types'} onclick={() => (activeTab = 'types')}>
			Proposal types <span class="text-muted">·</span>
			{data.types.length}
		</Tab>
		<Tab active={activeTab === 'members'} onclick={() => (activeTab = 'members')}>
			Members <span class="text-muted">·</span>
			{data.members.items.length}
		</Tab>
		<Tab active={activeTab === 'webhooks'} onclick={() => (activeTab = 'webhooks')}>
			Webhooks <span class="text-muted">·</span>
			{webhooks.length}
		</Tab>
		<Tab danger active={activeTab === 'danger'} onclick={() => (activeTab = 'danger')}>
			Danger zone
		</Tab>
	</Tabs>

	{#if activeTab === 'general'}
		{#if form?.generalSuccess}
			<Alert variant="success" class="mb-5">Saved.</Alert>
		{/if}
		{#if form?.generalError}
			<Alert variant="error" class="mb-5">{form.generalError}</Alert>
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
				<Button type="submit" variant="accent">Save changes</Button>
			</div>
		</form>
	{:else if activeTab === 'types'}
		<ProposalTypesPanel types={data.types} methodOptions={data.methodOptions} {form} />
	{:else if activeTab === 'members'}
		{#if form?.memberSuccess}
			<Alert variant="success" class="mb-5">Updated.</Alert>
		{/if}
		{#if form?.memberError}
			<Alert variant="error" class="mb-5">{form.memberError}</Alert>
		{/if}

		<p class="hint mb-4">
			{data.members.items.length} member{data.members.items.length === 1 ? '' : 's'} in this community.
		</p>

		<div>
			{#each data.members.items as member (member.userId)}
				<MemberRow avatarLabel={memberInitials(member)} avatarAdmin={member.role === 'admin'}>
					{#snippet name()}
						<span>{memberDisplayName(member)}</span>
						{#if member.role === 'admin'}
							<span class="meta-pill bg-accent-soft text-accent-ink">Admin</span>
						{/if}
						{#if member.userId === data.user?.id}
							<span class="text-[12px] font-normal text-muted">(you)</span>
						{/if}
					{/snippet}
					{#snippet meta()}
						{#if member.walletAddress}
							<span>{shortenWallet(member.walletAddress)}</span>
						{/if}
						<span>Joined {formatRelativeTime(member.joinedAt)}</span>
						<span>{member.voteCount} {member.voteCount === 1 ? 'vote' : 'votes'}</span>
					{/snippet}
					{#snippet trailing()}
						{#if member.userId !== data.user?.id}
							<div class="flex shrink-0 gap-2">
								<form method="POST" action="?/updateRole" use:enhance>
									<input type="hidden" name="userId" value={member.userId} />
									<input
										type="hidden"
										name="role"
										value={member.role === 'admin' ? 'member' : 'admin'}
									/>
									<Button type="submit" variant="ghost" size="sm">
										{member.role === 'admin' ? 'Demote' : 'Promote'}
									</Button>
								</form>
								<form method="POST" action="?/removeMember" use:enhance>
									<input type="hidden" name="userId" value={member.userId} />
									<Button type="submit" variant="danger" size="sm">Remove</Button>
								</form>
							</div>
						{/if}
					{/snippet}
				</MemberRow>
			{/each}
		</div>
	{:else if activeTab === 'webhooks'}
		{#if webhookSecret}
			<Alert variant="warn" class="mb-5">
				<p class="m-0 mb-2 font-medium">
					Webhook ready — copy the secret now. We won't show it again.
				</p>
				<code class="block rounded-lg bg-black/5 px-3 py-2.5 font-mono text-[13px] select-all">
					{webhookSecret}
				</code>
				<Button onclick={() => (webhookSecret = null)} variant="ghost" size="sm" class="mt-3">
					Dismiss
				</Button>
			</Alert>
		{/if}

		{#if webhooks.length > 0}
			<div class="mb-7 flex flex-col gap-2.5">
				{#each webhooks as wh (wh.id)}
					<VoteCard padded={false} class="px-5 py-[18px]">
						<div class="flex items-start justify-between gap-4">
							<div class="min-w-0 flex-1">
								<p class="m-0 font-mono text-[13px] break-all text-ink">
									{wh.url}
								</p>
								<p class="hint mt-1.5">Events: {wh.events.join(', ')}</p>
								<p class="hint mt-0.5">
									Created {formatRelativeTime(wh.createdAt)}
								</p>
							</div>
							<div class="flex shrink-0 gap-2">
								<Button
									onclick={() => toggleWebhook(wh.id, !wh.active)}
									variant="ghost"
									size="sm"
									aria-pressed={wh.active}
									aria-label="Toggle webhook {wh.active ? 'off' : 'on'}"
								>
									{wh.active ? 'Active' : 'Paused'}
								</Button>
								<Button onclick={() => deleteWebhook(wh.id)} variant="danger" size="sm"
									>Delete</Button
								>
							</div>
						</div>
					</VoteCard>
				{/each}
			</div>
		{:else}
			<div class="empty mb-7">
				<p>No webhooks yet. Add one below to forward events to your tools.</p>
			</div>
		{/if}

		<VoteCard title="Add a webhook" titleAs="h3">
			{#if webhookError}
				<Alert variant="error" class="mb-4">{webhookError}</Alert>
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
					<div class="flex flex-wrap gap-2">
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
					<Button type="submit" variant="accent" disabled={webhookLoading}>
						{#if webhookLoading}
							<Spinner /> Adding…
						{:else}
							Add webhook
						{/if}
					</Button>
				</div>
			</form>
		</VoteCard>
	{:else if activeTab === 'danger'}
		{#if form?.dangerError}
			<Alert variant="error" class="mb-5">{form.dangerError}</Alert>
		{/if}

		<div class="rounded-[var(--vc-radius-xl)] border border-danger-line bg-danger-bg p-6">
			<h3 class="m-0 font-display text-[length:var(--vc-text-xl)] font-normal text-danger-strong">
				Delete this community
			</h3>
			<p class="mt-2 text-[14px] leading-[1.55] text-ink-2">
				This permanently removes <strong>{data.community.name}</strong> along with every proposal, vote,
				member, webhook, and invite. There's no coming back from this.
			</p>

			{#if !showDeleteConfirm}
				<Button onclick={() => (showDeleteConfirm = true)} variant="destructive" class="mt-5">
					Delete community
				</Button>
			{:else}
				<div
					class="mt-5 rounded-xl border border-[oklch(0.55_0.16_28/0.4)] bg-[oklch(0.55_0.16_28/0.06)] p-4"
				>
					<p class="m-0 mb-2.5 text-[14px] text-[oklch(0.4_0.16_28)]">
						Type <strong>{data.community.name}</strong> to confirm.
					</p>
					<input
						type="text"
						bind:value={confirmName}
						placeholder={data.community.name}
						class="input border-[oklch(0.55_0.16_28/0.3)]"
					/>
					<div class="mt-3.5 flex gap-2.5">
						<form method="POST" action="?/deleteCommunity" use:enhance>
							<Button
								type="submit"
								variant="destructive"
								disabled={confirmName !== data.community.name}
							>
								I understand — delete it
							</Button>
						</form>
						<Button
							variant="ghost"
							onclick={() => {
								showDeleteConfirm = false;
								confirmName = '';
							}}
						>
							Cancel
						</Button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</Page>
