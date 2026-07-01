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

<a
	href={resolve(`/communities/${community.slug}`)}
	class="relative flex min-h-[200px] flex-col gap-[18px] rounded-[var(--vc-radius-xl)] border border-line bg-surface p-[22px] text-inherit no-underline transition-[border-color,transform,box-shadow] duration-[var(--vc-duration-base)] ease-[var(--vc-ease)] hover:-translate-y-0.5 hover:border-line-2 hover:shadow-[var(--vc-shadow-md)] {mine
		? 'border-line-2 bg-[linear-gradient(180deg,var(--vc-bg-2),var(--vc-surface))]'
		: ''}"
>
	<div class="flex items-start gap-3.5">
		<span
			class="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--vc-radius-lg)] font-display text-[20px] {mine
				? 'bg-accent-soft text-accent-ink'
				: 'bg-bg-2 text-ink'}">{initials}</span
		>
		<div class="min-w-0 flex-1">
			<h3
				class="mt-0 mb-1.5 font-display text-[length:var(--vc-text-lg)] leading-[1.15] font-normal tracking-[-0.01em] text-ink"
			>
				{community.name}
			</h3>
			{#if community.description}
				<p class="m-0 line-clamp-2 text-[14px] leading-[1.5] text-muted">{community.description}</p>
			{/if}
		</div>
	</div>

	{#if mine && activity != null}
		<div class="h-[3px] overflow-hidden rounded-full bg-line">
			<span
				class="block h-full rounded-[inherit] bg-accent"
				style="width: {Math.round(activity * 100)}%"
			></span>
		</div>
	{/if}

	<div
		class="mt-auto flex items-center gap-3.5 font-mono text-[11px] tracking-[var(--vc-tracking-mono)] text-muted uppercase [&_strong]:font-body [&_strong]:text-[13px] [&_strong]:font-medium [&_strong]:tracking-normal [&_strong]:text-ink [&_strong]:normal-case"
	>
		{#if mine}
			{#if pending != null}
				<span class="inline-flex items-center gap-1.5"><strong>{pending}</strong>open</span>
			{/if}
			<span class="inline-flex items-center gap-1.5"
				><strong>{community.memberCount}</strong>members</span
			>
			{#if role}
				<span class="ml-auto">{role}</span>
			{/if}
		{:else if showAge}
			<span class="inline-flex items-center gap-1.5"
				><strong>{community.memberCount}</strong>members</span
			>
			<span class="ml-auto">{formatRelativeTime(community.createdAt)}</span>
		{:else}
			<span class="inline-flex items-center gap-1.5"
				><strong>{community.memberCount}</strong>members</span
			>
			<span class="inline-flex items-center gap-1.5"
				><strong>{community.voteCount.toLocaleString()}</strong>votes</span
			>
		{/if}
	</div>
</a>
