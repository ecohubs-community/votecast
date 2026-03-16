<script lang="ts">
	import CommunityCard from '$lib/components/CommunityCard.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import type { PageData } from './$types';
	import hero from '$lib/assets/hero.png';
	import { resolve } from '$app/paths';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>LumiVote — Community Governance, Simplified</title>
</svelte:head>

<!-- Hero -->
<section class="py-14 text-center">
	<img src={hero} alt="LumiVote" class="h-80 w-80 mx-auto mb-4" />
	<h1 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
		Community Governance, Simplified
	</h1>
	<p class="mx-auto mt-4 max-w-2xl text-lg text-gray-600">
		Create proposals, vote on decisions, and shape the future of your community — whether it's an
		eco-village, cooperative, or online collective.
	</p>
	<div class="mt-8 flex items-center justify-center gap-4">
		{#if data.user}
			<a
				href={resolve("/communities/create")}
				class="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
			>
				Create Community
			</a>
			<a
				href="#communities"
				class="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
			>
				Browse Communities
			</a>
		{:else}
			<a
				href={resolve("/register")}
				class="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
			>
				Get Started
			</a>
			<a
				href={resolve("/login")}
				class="rounded-md border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
			>
				Sign In
			</a>
		{/if}
	</div>
</section>

<!-- My Communities (logged in only) -->
{#if data.user && data.myCommunities}
	<section class="mt-10">
		<div class="flex items-center justify-between">
			<h2 class="text-2xl font-bold text-gray-900">My Communities</h2>
			<a
				href={resolve("/communities/create")}
				class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
			>
				Create Community
			</a>
		</div>
		{#if data.myCommunities.items.length > 0}
			<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.myCommunities.items as { community, memberCount, voteCount } (community.id)}
					<CommunityCard
						community={{
							name: community.name,
							slug: community.slug,
							description: community.description,
							memberCount,
							voteCount,
							createdAt: community.createdAt
						}}
					/>
				{/each}
			</div>
		{:else}
			<EmptyState
				icon="communities"
				message="You haven't joined any communities yet."
				actionText="Create your first one"
				actionHref="/communities/create"
			/>
		{/if}
	</section>
{/if}

<!-- New Communities -->
<section id="communities" class="mt-12">
	<h2 class="text-2xl font-bold text-gray-900">New Communities</h2>
	{#if data.newest.length > 0}
		<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.newest as community (community.id)}
				<CommunityCard {community} />
			{/each}
		</div>
	{:else}
		<EmptyState
			icon="communities"
			message="No communities have been created yet. Be the first!"
			actionText={data.user ? 'Create a community' : undefined}
			actionHref={data.user ? '/communities/create' : undefined}
		/>
	{/if}
</section>

<!-- Most Active -->
{#if data.mostActive.length > 0}
	<section class="mt-12 pb-8">
		<h2 class="text-2xl font-bold text-gray-900">Most Active</h2>
		<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.mostActive as community (community.id)}
				<CommunityCard {community} />
			{/each}
		</div>
	</section>
{/if}
