<script lang="ts">
	import VoteCard from '$lib/components/VoteCard.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Extensions — VoteCast</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="page">
	<header class="page-head">
		<div>
			<h1 class="page-title">Extensions</h1>
			<p class="page-sub">
				What the voting engine ships with. <strong>Method modules</strong> define how votes are cast
				and decided (core governance). <strong>Event plugins</strong> react to lifecycle events without
				changing the rules.
			</p>
		</div>
	</header>

	<VoteCard as="section" title="Method modules" class="mb-6">
		<h3 class="ext-subhead">Ballots</h3>
		<ul class="ext-list">
			{#each data.ballotModules as m (m.id)}
				<li><code>{m.id}</code><span class="ext-tag">{m.tallyFamily}</span></li>
			{/each}
		</ul>

		<h3 class="ext-subhead">Decision rules</h3>
		<ul class="ext-list">
			{#each data.decisionRules as r (r.id)}
				<li><code>{r.id}</code><span class="ext-tag">accepts {r.accepts}</span></li>
			{/each}
		</ul>
	</VoteCard>

	<VoteCard as="section" title="Event plugins">
		<ul class="ext-list">
			{#each data.plugins as p (p.name)}
				<li>
					<code>{p.name}</code>
					<span class="ext-tag">{p.events.join(', ')}</span>
				</li>
			{/each}
		</ul>
	</VoteCard>
</div>

<style>
	.ext-subhead {
		font-size: 13px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--vc-muted);
		margin: 16px 0 8px;
	}
	.ext-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.ext-list li {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}
	.ext-list code {
		font-family: var(--vc-font-mono, monospace);
		font-size: 13px;
	}
	.ext-tag {
		font-size: 12px;
		color: var(--vc-muted);
	}
</style>
