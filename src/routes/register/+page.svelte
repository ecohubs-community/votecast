<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import Spinner from '$lib/components/Spinner.svelte';
	import Button from '$lib/components/Button.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import Page from '$lib/components/Page.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import PageSub from '$lib/components/PageSub.svelte';
	import { resolve } from '$app/paths';

	let { data } = $props();
	let redirectTo = $derived(data.redirectTo);

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	const handleRegister = async (e: SubmitEvent) => {
		e.preventDefault();
		error = '';

		if (password.length < 8) {
			error = 'Pick a password with at least 8 characters.';
			return;
		}

		loading = true;

		try {
			const result = await authClient.signUp.email({ name, email, password });

			if (result.error) {
				error = result.error.message ?? "Couldn't create your account. Please try again.";
			} else {
				window.location.href = redirectTo;
			}
		} catch {
			error = 'Something went sideways. Please try again.';
		} finally {
			loading = false;
		}
	};
</script>

<svelte:head>
	<title>Create your account — VoteCast</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Page narrow>
	<PageTitle class="text-center">
		Make space for <em>your people.</em>
	</PageTitle>
	<PageSub class="mx-auto text-center">
		A name, an email, and a password — that's all you need to start.
	</PageSub>

	<div style="margin-top: 40px;">
		{#if error}
			<Alert variant="error" role="alert" class="mb-5">
				{error}
			</Alert>
		{/if}

		<form onsubmit={handleRegister} class="form-stack">
			<div class="field">
				<label for="name" class="label">Name</label>
				<input
					id="name"
					type="text"
					bind:value={name}
					required
					autocomplete="name"
					class="input"
					placeholder="What should people call you?"
				/>
			</div>

			<div class="field">
				<label for="email" class="label">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					required
					autocomplete="email"
					class="input"
					placeholder="you@example.com"
				/>
			</div>

			<div class="field">
				<label for="password" class="label">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					required
					minlength={8}
					autocomplete="new-password"
					class="input"
					placeholder="At least 8 characters"
				/>
			</div>

			<Button type="submit" variant="accent" size="lg" disabled={loading} class="w-full">
				{#if loading}
					<Spinner />
					Creating your account…
				{:else}
					Create account
				{/if}
			</Button>
		</form>

		<p style="margin-top: 28px; text-align: center; font-size: 14px; color: var(--vc-muted);">
			Already have an account?
			<!-- eslint-disable svelte/no-navigation-without-resolve -- path is resolve()'d; only a query string is appended -->
			<a
				href={`${resolve('/login')}${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
				style="color: var(--vc-accent-ink); border-bottom: 1px solid var(--vc-line-2); padding-bottom: 1px;"
			>
				Sign in
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</p>
	</div>
</Page>
