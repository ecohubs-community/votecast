<script lang="ts">
	import CommunityCard from '$lib/components/CommunityCard.svelte';
	import BallotPreview from '$lib/components/BallotPreview.svelte';
	import type { PageData } from './$types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { data }: { data: PageData } = $props();

	const canonical = $derived(new URL(page.url.pathname, page.url.origin).href);
	const ogImage = $derived(new URL('/og-default.jpg', page.url.origin).href);
	const metaDescription =
		'VoteCast is community governance, simplified — create proposals, run transparent votes, and make decisions together in eco villages, cooperatives, and online collectives.';

	const firstName = $derived.by(() => {
		const name = data.user?.displayName || data.user?.name || '';
		return name.trim().split(/\s+/)[0] || 'there';
	});

	const communityCount = $derived(data.myCommunities?.items.length ?? 0);

	// Structured data for search engines (brand entity + site). Escaped to be
	// safe for inline injection inside a <script> tag.
	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@graph': [
				{
					'@type': 'Organization',
					name: 'VoteCast',
					url: page.url.origin,
					logo: ogImage,
					description: metaDescription
				},
				{
					'@type': 'WebSite',
					name: 'VoteCast',
					url: page.url.origin,
					description: metaDescription
				}
			]
		}).replace(/</g, '\\u003c')
	);

	// Full <script> tag built here; closing tag split so it can't terminate
	// this module's own <script> block.
	const jsonLdTag = $derived(`<script type="application/ld+json">${jsonLd}<` + `/script>`);
</script>

<svelte:head>
	<title>VoteCast — Community Governance, Simplified</title>
	<meta name="description" content={metaDescription} />
	<link rel="canonical" href={canonical} />
	<meta property="og:title" content="VoteCast — Community Governance, Simplified" />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="632" />
	<meta property="og:image:alt" content="VoteCast — community governance, simplified" />
	<meta name="twitter:title" content="VoteCast — Community Governance, Simplified" />
	<meta name="twitter:description" content={metaDescription} />
	<meta name="twitter:image" content={ogImage} />
	<meta name="twitter:image:alt" content="VoteCast — community governance, simplified" />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON-LD is escaped (< → <) and built from static strings only -->
	{@html jsonLdTag}
</svelte:head>

<!-- Hero -->
<section class="hero">
	<div class="wrap hero-grid">
		<div>
			<div class="eyebrow">Community governance · simplified</div>
			<h1 class="h1">
				Decisions, made <em>together.</em>
			</h1>
			<p class="lede">
				{#if data.user}
					Welcome back, {firstName}. {#if communityCount > 0}You're part of {communityCount}
						{communityCount === 1 ? 'community' : 'communities'} — see what's open below.{:else}Find
						a community to join, or start your own.{/if}
				{:else}
					A quiet, transparent way for real communities to propose, deliberate, and decide — without
					the noise of governance dashboards.
				{/if}
			</p>
			<div class="hero-cta">
				{#if data.user}
					<a href="#mine" class="btn btn-accent btn-lg">Open my communities</a>
					<a href={resolve('/communities/create')} class="btn btn-ghost btn-lg">
						Create a community
					</a>
				{:else}
					<a href={resolve('/register')} class="btn btn-accent btn-lg">Get started</a>
					<a href="#communities" class="btn btn-ghost btn-lg">Browse communities</a>
				{/if}
			</div>
			<div class="hero-meta">
				<span>One person, one vote</span>
				<span class="dot"></span>
				<span>Public &amp; private proposals</span>
				<span class="dot"></span>
				<span>Free for small groups</span>
			</div>
		</div>
		<div>
			<BallotPreview />
		</div>
	</div>
</section>

<!-- How it works strip -->
<section class="strip">
	<div class="wrap strip-inner">
		<div class="step">
			<div class="step-num">01</div>
			<h3>Start a community</h3>
			<p>Invite members with a link. No tokens, no jargon — just a roster and a name.</p>
		</div>
		<div class="step">
			<div class="step-num">02</div>
			<h3>Open a proposal</h3>
			<p>Write what's being decided. Add the options. Set when voting starts and ends.</p>
		</div>
		<div class="step">
			<div class="step-num">03</div>
			<h3>Decide, together</h3>
			<p>Members vote in a tap. Results are visible to everyone, the moment voting closes.</p>
		</div>
	</div>
</section>

<!-- My Communities (logged in only) -->
{#if data.user && data.myCommunities}
	<section id="mine" class="section">
		<div class="wrap">
			<div class="section-head">
				<div>
					<p class="section-kicker">Yours</p>
					<h2 class="section-title">My communities</h2>
				</div>
				<a href={resolve('/communities/create')} class="section-link">Create one →</a>
			</div>

			<div
				class="grid grid-cols-3 gap-[var(--vc-grid-gap)] max-[900px]:grid-cols-2 max-[600px]:grid-cols-1"
			>
				{#each data.myCommunities.items as item (item.community.id)}
					<CommunityCard
						community={{
							name: item.community.name,
							slug: item.community.slug,
							description: item.community.description,
							memberCount: item.memberCount,
							voteCount: item.voteCount,
							createdAt: item.community.createdAt
						}}
						mine
						role={item.role}
					/>
				{/each}
				<a
					href={resolve('/communities/create')}
					class="flex min-h-[200px] flex-col items-center justify-center gap-[18px] rounded-[var(--vc-radius-xl)] border border-dashed border-line bg-transparent p-[22px] text-center text-muted no-underline transition-[border-color,transform,box-shadow] duration-[var(--vc-duration-base)] ease-[var(--vc-ease)] hover:-translate-y-0.5 hover:border-line-2 hover:shadow-[var(--vc-shadow-md)]"
				>
					<div>
						<div class="mb-1.5 font-display text-[24px] text-ink">Start something</div>
						<div class="text-[13px]">Create a new community →</div>
					</div>
				</a>
			</div>
		</div>
	</section>
{/if}

<!-- New Communities -->
<section id="communities" class="section">
	<div class="wrap">
		<div class="section-head">
			<div>
				<p class="section-kicker">Newest</p>
				<h2 class="section-title">New communities</h2>
			</div>
		</div>

		{#if data.newest.length > 0}
			<div
				class="grid grid-cols-3 gap-[var(--vc-grid-gap)] max-[900px]:grid-cols-2 max-[600px]:grid-cols-1"
			>
				{#each data.newest as community (community.id)}
					<CommunityCard {community} showAge />
				{/each}
			</div>
		{:else}
			<div class="empty">
				<p>No communities have been created yet. Be the first!</p>
				{#if data.user}
					<a href={resolve('/communities/create')} class="btn btn-ghost">Create a community</a>
				{/if}
			</div>
		{/if}
	</div>
</section>

<!-- Most Active -->
{#if data.mostActive.length > 0}
	<section id="active" class="section">
		<div class="wrap">
			<div class="section-head">
				<div>
					<p class="section-kicker">Most active</p>
					<h2 class="section-title">Where decisions are happening</h2>
				</div>
			</div>

			<div
				class="grid grid-cols-3 gap-[var(--vc-grid-gap)] max-[900px]:grid-cols-2 max-[600px]:grid-cols-1"
			>
				{#each data.mostActive as community (community.id)}
					<CommunityCard {community} />
				{/each}
			</div>
		</div>
	</section>
{/if}
