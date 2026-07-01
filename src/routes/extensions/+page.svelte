<script lang="ts">
	import VoteCard from '$lib/components/VoteCard.svelte';
	import Page from '$lib/components/Page.svelte';
	import PageHead from '$lib/components/PageHead.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import PageSub from '$lib/components/PageSub.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	const subhead = 'mt-4 mb-2 text-[13px] tracking-[0.06em] text-muted uppercase';
	const list =
		'm-0 flex list-none flex-col gap-1.5 p-0 [&_code]:font-mono [&_code]:text-[13px] [&_li]:flex [&_li]:flex-wrap [&_li]:items-center [&_li]:gap-2.5';
	const tag = 'text-[12px] text-muted';
</script>

<svelte:head>
	<title>Extensions — VoteCast</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Page>
	<PageHead>
		<div>
			<PageTitle>Extensions</PageTitle>
			<PageSub>
				What the voting engine ships with. <strong>Method modules</strong> define how votes are cast
				and decided (core governance). <strong>Event plugins</strong> react to lifecycle events without
				changing the rules.
			</PageSub>
		</div>
	</PageHead>

	<VoteCard as="section" title="Method modules" class="mb-6">
		<h3 class={subhead}>Ballots</h3>
		<ul class={list}>
			{#each data.ballotModules as m (m.id)}
				<li><code>{m.id}</code><span class={tag}>{m.tallyFamily}</span></li>
			{/each}
		</ul>

		<h3 class={subhead}>Decision rules</h3>
		<ul class={list}>
			{#each data.decisionRules as r (r.id)}
				<li><code>{r.id}</code><span class={tag}>accepts {r.accepts}</span></li>
			{/each}
		</ul>
	</VoteCard>

	<VoteCard as="section" title="Event plugins">
		<ul class={list}>
			{#each data.plugins as p (p.name)}
				<li>
					<code>{p.name}</code>
					<span class={tag}>{p.events.join(', ')}</span>
				</li>
			{/each}
		</ul>
	</VoteCard>
</Page>
