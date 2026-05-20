<script lang="ts">
	import { formatRelativeTime } from '$lib/utils/format';
	import { resolve } from '$app/paths';

	type Props = {
		community: {
			name: string;
			slug: string;
			description: string;
			memberCount: number;
			voteCount: number;
			createdAt: Date;
		};
		mine?: boolean;
		pending?: number;
		role?: string;
		activity?: number;
		showAge?: boolean;
	};

	let { community, mine = false, pending, role, activity, showAge = false }: Props = $props();

	const initials = $derived(
		community.name
			.split(' ')
			.slice(0, 2)
			.map((w) => w[0] ?? '')
			.join('')
			.toUpperCase()
	);
</script>

<a href={resolve(`/communities/${community.slug}`)} class="card" class:mine>
	<div class="card-head">
		<span class="card-thumb" class:accent={mine}>{initials}</span>
		<div class="card-head-body">
			<h3 class="card-title">{community.name}</h3>
			{#if community.description}
				<p class="card-desc">{community.description}</p>
			{/if}
		</div>
	</div>

	{#if mine && activity != null}
		<div class="card-active-bar">
			<span style="width: {Math.round(activity * 100)}%"></span>
		</div>
	{/if}

	<div class="card-foot">
		{#if mine}
			{#if pending != null}
				<span class="stat"><strong>{pending}</strong>open</span>
			{/if}
			<span class="stat"><strong>{community.memberCount}</strong>members</span>
			{#if role}
				<span class="meta-right">{role}</span>
			{/if}
		{:else if showAge}
			<span class="stat"><strong>{community.memberCount}</strong>members</span>
			<span class="meta-right">{formatRelativeTime(community.createdAt)}</span>
		{:else}
			<span class="stat"><strong>{community.memberCount}</strong>members</span>
			<span class="stat"><strong>{community.voteCount.toLocaleString()}</strong>votes</span>
		{/if}
	</div>
</a>
