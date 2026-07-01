<script lang="ts">
	import { enhance } from '$app/forms';
	import ProposalCard from '$lib/components/ProposalCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Button from '$lib/components/Button.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import Tab from '$lib/components/Tab.svelte';
	import VoteCard from '$lib/components/VoteCard.svelte';
	import { formatRelativeTime } from '$lib/utils/format';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const pageTitle = $derived(`${data.community.name} — VoteCast`);
	const canonical = $derived(new URL(`/communities/${data.community.slug}`, page.url.origin).href);
	const ogImage = $derived(new URL('/og-default.jpg', page.url.origin).href);
	const isPublic = $derived(data.community.visibility === 'public');
	const metaDescription = $derived(
		(
			data.community.description?.trim() ||
			`${data.community.name} on VoteCast — propose, deliberate, and decide together.`
		).slice(0, 200)
	);

	let showInviteForm = $state(false);
	let copied = $state(false);
	let activeTab = $state<'proposals' | 'members'>('proposals');

	const statuses = [
		{ label: 'All', value: null },
		{ label: 'Open', value: 'voting' },
		{ label: 'Upcoming', value: 'upcoming' },
		{ label: 'Closed', value: 'closed' }
	] as const;

	const defaultExpiry = $derived.by(() => {
		const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
		return d.toISOString().slice(0, 16);
	});

	async function copyInviteUrl() {
		if (form?.inviteUrl) {
			await navigator.clipboard.writeText(form.inviteUrl);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		}
	}

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
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={metaDescription} />
	<link rel="canonical" href={canonical} />
	{#if !isPublic}
		<meta name="robots" content="noindex, nofollow" />
	{/if}
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={ogImage} />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={metaDescription} />
	<meta name="twitter:image" content={ogImage} />
</svelte:head>

<div class="page">
	<a href={resolve('/')} class="breadcrumb">All communities</a>

	<header class="page-head">
		<div>
			<h1 class="page-title">{data.community.name}</h1>
			{#if data.community.description}
				<p class="page-sub">{data.community.description}</p>
			{/if}
		</div>

		{#if data.membership}
			<div class="flex flex-wrap gap-3">
				<span class="vc-badge vc-badge--active" style="text-transform: none; letter-spacing: 0;">
					{data.membership.role === 'admin' ? 'Admin' : 'Member'}
				</span>
				{#if data.membership.role === 'admin'}
					<Button href={resolve(`/communities/${data.community.slug}/settings`)} variant="ghost">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.6"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
							/>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
							/>
						</svg>
						Settings
					</Button>
					<Button onclick={() => (showInviteForm = !showInviteForm)} variant="ghost">
						Invite members
					</Button>
				{/if}
				<Button
					href={resolve(`/communities/${data.community.slug}/create-proposal`)}
					variant="accent"
				>
					New proposal
				</Button>
			</div>
		{/if}
	</header>

	{#if showInviteForm && data.membership?.role === 'admin'}
		<VoteCard as="section" title="Generate an invite link" titleAs="h3" class="mb-8">
			{#if form?.inviteError}
				<Alert variant="error" class="mb-4">{form.inviteError}</Alert>
			{/if}

			{#if form?.inviteUrl}
				<Alert variant="success" class="mb-4">
					<p style="margin: 0 0 8px; font-weight: 500;">
						Link ready — share it with whoever should join.
					</p>
					<div style="display: flex; gap: 8px; align-items: center;">
						<input type="text" readonly value={form.inviteUrl} class="input" style="flex: 1;" />
						<Button onclick={copyInviteUrl} type="button" variant="ghost" size="sm">
							{copied ? 'Copied' : 'Copy'}
						</Button>
					</div>
				</Alert>
			{/if}

			<form method="POST" action="?/invite" use:enhance class="flex flex-wrap items-end gap-3">
				<div class="field" style="flex: 0 0 140px;">
					<label for="maxUses" class="label">
						Max uses<span class="label-optional">optional</span>
					</label>
					<input
						type="number"
						id="maxUses"
						name="maxUses"
						min="1"
						placeholder="Unlimited"
						class="input"
					/>
				</div>

				<div class="field" style="flex: 1; min-width: 220px;">
					<label for="expiresAt" class="label">Expires</label>
					<input
						type="datetime-local"
						id="expiresAt"
						name="expiresAt"
						required
						value={defaultExpiry}
						class="input"
					/>
				</div>

				<Button type="submit" variant="primary">Generate link</Button>
			</form>
		</VoteCard>
	{/if}

	<Tabs>
		<Tab active={activeTab === 'proposals'} onclick={() => (activeTab = 'proposals')}>Proposals</Tab
		>
		{#if data.membership && data.members}
			<Tab active={activeTab === 'members'} onclick={() => (activeTab = 'members')}>
				Members <span class="text-muted">·</span>
				{data.members.items.length}{data.members.nextCursor ? '+' : ''}
			</Tab>
		{/if}
	</Tabs>

	{#if activeTab === 'proposals'}
		<div class="chips">
			{#each statuses as { label, value } (label)}
				{@const isActive = data.phaseFilter === value}
				<a
					href={resolve(`/communities/${data.community.slug}${value ? `?phase=${value}` : ''}`)}
					class="chip"
					class:active={isActive}
				>
					{label}
				</a>
			{/each}
		</div>

		{#if data.proposals.items.length > 0}
			<div style="display: flex; flex-direction: column; gap: 12px;">
				{#each data.proposals.items as proposal (proposal.id)}
					<ProposalCard
						proposal={{
							id: proposal.id,
							title: proposal.title,
							phase: proposal.phase,
							startTime: proposal.startTime,
							endTime: proposal.endTime,
							body: proposal.body ?? undefined,
							visibility: proposal.visibility
						}}
						locked={proposal.visibility === 'community' && !data.membership}
					/>
				{/each}
			</div>

			{#if data.proposals.nextCursor}
				<div style="margin-top: 28px; text-align: center;">
					<Button
						href={resolve(
							`/communities/${data.community.slug}?cursor=${data.proposals.nextCursor}${data.phaseFilter ? `&phase=${data.phaseFilter}` : ''}`
						)}
						variant="ghost"
						size="sm"
					>
						Load more
					</Button>
				</div>
			{/if}
		{:else}
			<EmptyState
				message={data.phaseFilter
					? `No ${data.phaseFilter} proposals here yet.`
					: 'Nothing has been put to a vote yet.'}
				actionText={data.membership ? 'Open the first one' : undefined}
				actionHref={data.membership
					? resolve(`/communities/${data.community.slug}/create-proposal`)
					: undefined}
			/>
		{/if}
	{:else if activeTab === 'members' && data.members}
		{#if data.members.items.length > 0}
			<div>
				{#each data.members.items as member (member.userId)}
					{@const name = memberDisplayName(member)}
					{@const wallet = shortenWallet(member.walletAddress)}
					<div class="member-row">
						<div class="member-avatar" class:admin={member.role === 'admin'}>
							{memberInitials(member)}
						</div>

						<div class="member-info">
							<div class="member-name">
								<span style="overflow: hidden; text-overflow: ellipsis;">{name}</span>
								{#if member.role === 'admin'}
									<span
										class="meta-pill"
										style="background: var(--vc-accent-soft); color: var(--vc-accent-ink);"
									>
										Admin
									</span>
								{/if}
							</div>
							<div class="member-meta">
								{#if wallet}
									<span>{wallet}</span>
								{/if}
								<span>Joined {formatRelativeTime(member.joinedAt)}</span>
							</div>
						</div>

						<div style="text-align: right; flex-shrink: 0;">
							<div
								style="font-size: 18px; font-weight: 500; color: var(--vc-ink); font-family: var(--vc-font-display);"
							>
								{member.voteCount}
							</div>
							<div
								style="font-family: var(--vc-font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--vc-muted);"
							>
								{member.voteCount === 1 ? 'vote' : 'votes'}
							</div>
						</div>
					</div>
				{/each}
			</div>

			{#if data.members.nextCursor}
				<div style="margin-top: 28px; text-align: center;">
					<Button variant="ghost" size="sm">Load more</Button>
				</div>
			{/if}
		{:else}
			<EmptyState message="No members yet — be the first." />
		{/if}
	{/if}
</div>
