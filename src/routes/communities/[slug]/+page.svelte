<script lang="ts">
	import { enhance } from '$app/forms';
	import ProposalCard from '$lib/components/ProposalCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { formatRelativeTime } from '$lib/utils/format';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let showInviteForm = $state(false);
	let copied = $state(false);
	let activeTab = $state<'proposals' | 'members'>('proposals');

	const statuses = [
		{ label: 'All', value: null },
		{ label: 'Active', value: 'active' },
		{ label: 'Draft', value: 'draft' },
		{ label: 'Closed', value: 'closed' }
	] as const;

	// Default expiration: 7 days from now
	const defaultExpiry = $derived.by(() => {
		const d = new Date();
		d.setDate(d.getDate() + 7);
		return d.toISOString().slice(0, 16);
	});

	async function copyInviteUrl() {
		if (form?.inviteUrl) {
			await navigator.clipboard.writeText(form.inviteUrl);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		}
	}

	// Helper: shorten wallet address
	function shortenWallet(addr: string | null): string | null {
		if (!addr) return null;
		return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
	}

	// Helper: display name for a member
	function memberDisplayName(m: { displayName: string | null; name: string; walletAddress: string | null }): string {
		if (m.displayName) return m.displayName;
		if (m.name && /^0x[0-9a-fA-F]{10,}$/.test(m.name)) {
			return shortenWallet(m.name) ?? m.name;
		}
		return m.name;
	}

	// Helper: initials for avatar
	function memberInitials(m: { displayName: string | null; name: string; walletAddress: string | null }): string {
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
	<title>{data.community.name} — LumiVote</title>
</svelte:head>

<!-- Header -->
<section class="border-b border-gray-200 pb-6">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900 sm:text-3xl">{data.community.name}</h1>
			{#if data.community.description}
				<p class="mt-2 text-gray-600">{data.community.description}</p>
			{/if}
		</div>

		{#if data.membership}
			<div class="flex flex-wrap items-center gap-2 sm:shrink-0 sm:gap-3">
				<span class="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
					{data.membership.role === 'admin' ? 'Admin' : 'Member'}
				</span>
				{#if data.membership.role === 'admin'}
					<a
						href="/communities/{data.community.slug}/settings"
						class="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
						title="Community Settings"
					>
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
						</svg>
						Settings
					</a>
					<button
						onclick={() => (showInviteForm = !showInviteForm)}
						class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Invite Members
					</button>
				{/if}
				<a
					href="/communities/{data.community.slug}/create-proposal"
					class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
				>
					Create Proposal
				</a>
			</div>
		{/if}
	</div>
</section>

<!-- Invite form (admin only) -->
{#if showInviteForm && data.membership?.role === 'admin'}
	<section class="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
		<h3 class="text-sm font-semibold text-gray-900">Generate Invite Link</h3>

		{#if form?.inviteError}
			<div
				class="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
			>
				{form.inviteError}
			</div>
		{/if}

		{#if form?.inviteUrl}
			<div class="mt-3">
				<p class="text-sm text-green-700">Invite link generated:</p>
				<div class="mt-1 flex items-center gap-2">
					<input
						type="text"
						readonly
						value={form.inviteUrl}
						class="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
					/>
					<button
						onclick={copyInviteUrl}
						class="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
					>
						{copied ? 'Copied!' : 'Copy'}
					</button>
				</div>
			</div>
		{/if}

		<form
			method="POST"
			action="?/invite"
			use:enhance
			class="mt-3 grid grid-cols-1 items-end gap-3 sm:flex sm:flex-wrap sm:gap-4"
		>
			<div>
				<label for="maxUses" class="block text-xs font-medium text-gray-600">
					Max uses
					<span class="font-normal text-gray-400">(optional)</span>
				</label>
				<input
					type="number"
					id="maxUses"
					name="maxUses"
					min="1"
					placeholder="Unlimited"
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:w-28"
				/>
			</div>

			<div>
				<label for="expiresAt" class="block text-xs font-medium text-gray-600">Expires at</label>
				<input
					type="datetime-local"
					id="expiresAt"
					name="expiresAt"
					required
					value={defaultExpiry}
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				/>
			</div>

			<button
				type="submit"
				class="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
			>
				Generate Link
			</button>
		</form>
	</section>
{/if}

<!-- Top-level tab switcher: Proposals / Members -->
<div class="mt-6 flex gap-1 border-b border-gray-200">
	<button
		onclick={() => (activeTab = 'proposals')}
		class="px-4 py-2.5 text-sm font-medium transition-colors {activeTab === 'proposals'
			? 'border-b-2 border-blue-600 text-blue-600'
			: 'text-gray-500 hover:text-gray-700'}"
	>
		Proposals
	</button>
	{#if data.membership && data.members}
		<button
			onclick={() => (activeTab = 'members')}
			class="px-4 py-2.5 text-sm font-medium transition-colors {activeTab === 'members'
				? 'border-b-2 border-blue-600 text-blue-600'
				: 'text-gray-500 hover:text-gray-700'}"
		>
			Members ({data.members.items.length}{data.members.nextCursor ? '+' : ''})
		</button>
	{/if}
</div>

{#if activeTab === 'proposals'}
	<!-- Status filter tabs -->
	<div class="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
		<div class="flex gap-2">
			{#each statuses as { label, value }}
				{@const isActive = data.statusFilter === value}
				<a
					href="/communities/{data.community.slug}{value ? `?status=${value}` : ''}"
					class="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium {isActive
						? 'bg-blue-600 text-white'
						: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
				>
					{label}
				</a>
			{/each}
		</div>
	</div>

	<!-- Proposals list -->
	<section class="mt-4">
		{#if data.proposals.items.length > 0}
			<div class="space-y-3">
				{#each data.proposals.items as proposal}
					<ProposalCard
						proposal={{
							id: proposal.id,
							title: proposal.title,
							status: proposal.status,
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
				<div class="mt-6 text-center">
					<a
						href="/communities/{data.community.slug}?cursor={data.proposals
							.nextCursor}{data.statusFilter ? `&status=${data.statusFilter}` : ''}"
						class="text-sm font-medium text-blue-600 hover:text-blue-800"
					>
						Load more
					</a>
				</div>
			{/if}
		{:else}
			<EmptyState
				icon="proposals"
				message="No proposals yet."
				actionText={data.membership ? 'Create the first proposal' : undefined}
				actionHref={data.membership
					? `/communities/${data.community.slug}/create-proposal`
					: undefined}
			/>
		{/if}
	</section>
{:else if activeTab === 'members' && data.members}
	<!-- Members list -->
	<section class="mt-4">
		{#if data.members.items.length > 0}
			<div class="divide-y divide-gray-100">
				{#each data.members.items as member}
					{@const name = memberDisplayName(member)}
					{@const wallet = shortenWallet(member.walletAddress)}
					<div class="flex items-center gap-4 py-3">
						<!-- Avatar -->
						<div
							class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white"
						>
							{memberInitials(member)}
						</div>

						<!-- Info -->
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="truncate text-sm font-medium text-gray-900">
									{name}
								</span>
								{#if member.role === 'admin'}
									<span
										class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
									>
										Admin
									</span>
								{/if}
							</div>
							<div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
								{#if wallet}
									<span class="flex items-center gap-1">
										<svg
											class="h-3 w-3 text-gray-400"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											stroke-width="2"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3"
											/>
										</svg>
										{wallet}
									</span>
								{/if}
								<span>Joined {formatRelativeTime(member.joinedAt)}</span>
							</div>
						</div>

						<!-- Vote count -->
						<div class="shrink-0 text-right">
							<span class="text-sm font-medium text-gray-900">{member.voteCount}</span>
							<p class="text-xs text-gray-400">
								{member.voteCount === 1 ? 'vote' : 'votes'}
							</p>
						</div>
					</div>
				{/each}
			</div>

			{#if data.members.nextCursor}
				<div class="mt-6 text-center">
					<button
						class="text-sm font-medium text-blue-600 hover:text-blue-800"
					>
						Load more
					</button>
				</div>
			{/if}
		{:else}
			<EmptyState icon="communities" message="No members yet." />
		{/if}
	</section>
{/if}
