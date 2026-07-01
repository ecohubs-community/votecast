<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import VoteCard from '$lib/components/VoteCard.svelte';
	import Page from '$lib/components/Page.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Join {data.community.name} — VoteCast</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Page narrow>
	<VoteCard padded={false} class="px-8 py-10 text-center">
		<p class="m-0 mb-4 font-mono text-[12px] tracking-[0.06em] text-muted uppercase">
			You're invited to
		</p>
		<PageTitle class="!text-[clamp(28px,4vw,40px)]">
			{data.community.name}
		</PageTitle>

		{#if data.community.description}
			<p class="mx-auto mt-4 mb-0 max-w-[40ch] text-[15px] leading-[1.55] text-ink-2">
				{data.community.description}
			</p>
		{/if}

		{#if form?.error}
			<Alert variant="error" class="mt-6 text-left">{form.error}</Alert>
		{/if}

		{#if data.expired}
			<p class="mt-7 text-[14px] text-[oklch(0.5_0.14_28)]">This invite link has expired.</p>
		{:else if data.exhausted}
			<p class="mt-7 text-[14px] text-[oklch(0.5_0.14_28)]">This invite link is all used up.</p>
		{:else if data.alreadyMember}
			<p class="mt-7 text-[14px] text-muted">You're already part of this community.</p>
			<Button
				href={resolve(`/communities/${data.community.slug}`)}
				variant="accent"
				size="lg"
				class="mt-5"
			>
				Open community
			</Button>
		{:else if data.user}
			<form method="POST" use:enhance class="mt-7">
				<Button type="submit" variant="accent" size="lg">
					Join {data.community.name}
				</Button>
			</form>
		{:else}
			<p class="mt-7 text-[14px] text-muted">Sign in or create an account to accept this invite.</p>
			<div class="mt-5 flex flex-wrap justify-center gap-3">
				<Button
					href={`${resolve('/login')}?redirect=${encodeURIComponent(`/join/${data.token}`)}`}
					variant="accent"
				>
					Sign in
				</Button>
				<Button
					href={`${resolve('/register')}?redirect=${encodeURIComponent(`/join/${data.token}`)}`}
					variant="ghost"
				>
					Create account
				</Button>
			</div>
		{/if}
	</VoteCard>
</Page>
