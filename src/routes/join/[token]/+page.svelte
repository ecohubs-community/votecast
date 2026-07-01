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
		<p
			style="font-family: var(--vc-font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--vc-muted); margin: 0 0 16px;"
		>
			You're invited to
		</p>
		<PageTitle class="!text-[clamp(28px,4vw,40px)]">
			{data.community.name}
		</PageTitle>

		{#if data.community.description}
			<p
				style="margin: 16px auto 0; font-size: 15px; color: var(--vc-ink-2); line-height: 1.55; max-width: 40ch;"
			>
				{data.community.description}
			</p>
		{/if}

		{#if form?.error}
			<Alert variant="error" class="mt-6 text-left">{form.error}</Alert>
		{/if}

		{#if data.expired}
			<p style="margin-top: 28px; color: oklch(0.5 0.14 28); font-size: 14px;">
				This invite link has expired.
			</p>
		{:else if data.exhausted}
			<p style="margin-top: 28px; color: oklch(0.5 0.14 28); font-size: 14px;">
				This invite link is all used up.
			</p>
		{:else if data.alreadyMember}
			<p style="margin-top: 28px; color: var(--vc-muted); font-size: 14px;">
				You're already part of this community.
			</p>
			<Button
				href={resolve(`/communities/${data.community.slug}`)}
				variant="accent"
				size="lg"
				class="mt-5"
			>
				Open community
			</Button>
		{:else if data.user}
			<form method="POST" use:enhance style="margin-top: 28px;">
				<Button type="submit" variant="accent" size="lg">
					Join {data.community.name}
				</Button>
			</form>
		{:else}
			<p style="margin-top: 28px; color: var(--vc-muted); font-size: 14px;">
				Sign in or create an account to accept this invite.
			</p>
			<div
				style="margin-top: 20px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;"
			>
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
