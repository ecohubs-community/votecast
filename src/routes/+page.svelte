<script lang="ts">
	import CommunityCard from '$lib/components/CommunityCard.svelte';
	import BallotPreview from '$lib/components/BallotPreview.svelte';
	import Button from '$lib/components/Button.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Wrap from '$lib/components/Wrap.svelte';
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
<section class="relative pt-[clamp(56px,9vw,120px)] pb-[clamp(40px,6vw,80px)]">
	<Wrap
		class="grid grid-cols-[1.05fr_1fr] items-center gap-[clamp(40px,6vw,80px)] max-[1020px]:grid-cols-1"
	>
		<div>
			<div
				class="mb-7 inline-flex items-center gap-2.5 font-mono text-xs tracking-[var(--vc-tracking-eyebrow)] text-muted uppercase before:inline-block before:size-1.5 before:rounded-full before:bg-accent before:content-['']"
			>
				Community governance · simplified
			</div>
			<h1
				class="m-0 font-display text-[length:var(--vc-text-hero)] leading-[0.98] font-normal tracking-[var(--vc-tracking-tight)] text-balance break-words hyphens-none text-ink"
			>
				Decisions, made <em class="text-accent-ink">together.</em>
			</h1>
			<p
				class="mt-7 max-w-[36ch] text-[clamp(17px,1.6vw,19px)] leading-[var(--vc-leading-body)] text-pretty text-ink-2"
			>
				{#if data.user}
					Welcome back, {firstName}. {#if communityCount > 0}You're part of {communityCount}
						{communityCount === 1 ? 'community' : 'communities'} — see what's open below.{:else}Find
						a community to join, or start your own.{/if}
				{:else}
					A quiet, transparent way for real communities to propose, deliberate, and decide — without
					the noise of governance dashboards.
				{/if}
			</p>
			<div class="mt-9 flex flex-wrap gap-3">
				{#if data.user}
					<Button href="#mine" variant="accent" size="lg">Open my communities</Button>
					<Button href={resolve('/communities/create')} variant="ghost" size="lg">
						Create a community
					</Button>
				{:else}
					<Button href={resolve('/register')} variant="accent" size="lg">Get started</Button>
					<Button href="#communities" variant="ghost" size="lg">Browse communities</Button>
				{/if}
			</div>
			<div
				class="mt-6 flex flex-wrap gap-[18px] text-[13px] text-muted [&>span]:inline-flex [&>span]:items-center [&>span]:gap-2"
			>
				<span>One person, one vote</span>
				<span class="size-1 rounded-full bg-line-2"></span>
				<span>Public &amp; private proposals</span>
				<span class="size-1 rounded-full bg-line-2"></span>
				<span>Free for small groups</span>
			</div>
		</div>
		<div>
			<BallotPreview />
		</div>
	</Wrap>
</section>

<!-- How it works strip -->
<section class="border-y border-line py-[clamp(32px,5vw,56px)]">
	<Wrap
		class="grid grid-cols-3 gap-[clamp(24px,4vw,56px)] max-[720px]:grid-cols-1 max-[720px]:gap-6 [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-[24px] [&_h3]:leading-[1.15] [&_h3]:font-normal [&_h3]:tracking-[-0.01em] [&_h3]:text-ink [&_p]:m-0 [&_p]:max-w-[32ch] [&_p]:text-[14px] [&_p]:text-ink-2"
	>
		<div>
			<div class="mb-3 font-mono text-xs text-muted">01</div>
			<h3>Start a community</h3>
			<p>Invite members with a link. No tokens, no jargon — just a roster and a name.</p>
		</div>
		<div>
			<div class="mb-3 font-mono text-xs text-muted">02</div>
			<h3>Open a proposal</h3>
			<p>Write what's being decided. Add the options. Set when voting starts and ends.</p>
		</div>
		<div>
			<div class="mb-3 font-mono text-xs text-muted">03</div>
			<h3>Decide, together</h3>
			<p>Members vote in a tap. Results are visible to everyone, the moment voting closes.</p>
		</div>
	</Wrap>
</section>

<!-- My Communities (logged in only) -->
{#if data.user && data.myCommunities}
	<section id="mine" class="py-[var(--vc-space-11)]">
		<Wrap>
			<div class="mb-[clamp(28px,4vw,48px)] flex items-end justify-between gap-6">
				<div>
					<p
						class="mt-0 mb-2.5 font-mono text-xs tracking-[var(--vc-tracking-eyebrow)] text-muted uppercase"
					>
						Yours
					</p>
					<h2
						class="m-0 font-display text-[length:var(--vc-text-3xl)] leading-[var(--vc-leading-tight)] font-normal tracking-[var(--vc-tracking-tight)] text-ink"
					>
						My communities
					</h2>
				</div>
				<a
					href={resolve('/communities/create')}
					class="border-b border-line-2 pb-0.5 text-[14px] text-ink-2 no-underline transition-colors duration-[var(--vc-duration-fast)] ease-[var(--vc-ease)] hover:border-accent hover:text-accent-ink"
					>Create one →</a
				>
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
		</Wrap>
	</section>
{/if}

<!-- New Communities -->
<section id="communities" class="py-[var(--vc-space-11)]">
	<Wrap>
		<div class="mb-[clamp(28px,4vw,48px)] flex items-end justify-between gap-6">
			<div>
				<p
					class="mt-0 mb-2.5 font-mono text-xs tracking-[var(--vc-tracking-eyebrow)] text-muted uppercase"
				>
					Newest
				</p>
				<h2
					class="m-0 font-display text-[length:var(--vc-text-3xl)] leading-[var(--vc-leading-tight)] font-normal tracking-[var(--vc-tracking-tight)] text-ink"
				>
					New communities
				</h2>
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
			<EmptyState message="No communities have been created yet. Be the first!">
				{#if data.user}
					<Button href={resolve('/communities/create')} variant="ghost">Create a community</Button>
				{/if}
			</EmptyState>
		{/if}
	</Wrap>
</section>

<!-- Most Active -->
{#if data.mostActive.length > 0}
	<section id="active" class="py-[var(--vc-space-11)]">
		<Wrap>
			<div class="mb-[clamp(28px,4vw,48px)] flex items-end justify-between gap-6">
				<div>
					<p
						class="mt-0 mb-2.5 font-mono text-xs tracking-[var(--vc-tracking-eyebrow)] text-muted uppercase"
					>
						Most active
					</p>
					<h2
						class="m-0 font-display text-[length:var(--vc-text-3xl)] leading-[var(--vc-leading-tight)] font-normal tracking-[var(--vc-tracking-tight)] text-ink"
					>
						Where decisions are happening
					</h2>
				</div>
			</div>

			<div
				class="grid grid-cols-3 gap-[var(--vc-grid-gap)] max-[900px]:grid-cols-2 max-[600px]:grid-cols-1"
			>
				{#each data.mostActive as community (community.id)}
					<CommunityCard {community} />
				{/each}
			</div>
		</Wrap>
	</section>
{/if}
