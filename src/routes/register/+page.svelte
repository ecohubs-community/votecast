<script lang="ts">
	import { authClient } from '$lib/auth-client';
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

<div class="page-narrow">
	<h1 class="page-title" style="text-align: center;">
		Make space for <em>your people.</em>
	</h1>
	<p class="page-sub" style="text-align: center; margin-inline: auto;">
		A name, an email, and a password — that's all you need to start.
	</p>

	<div style="margin-top: 40px;">
		{#if error}
			<div class="alert alert-error" role="alert" style="margin-bottom: 20px;">
				{error}
			</div>
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

			<button type="submit" disabled={loading} class="btn btn-accent btn-lg" style="width: 100%;">
				{#if loading}
					<span class="spinner"></span>
					Creating your account…
				{:else}
					Create account
				{/if}
			</button>
		</form>

		<p style="margin-top: 28px; text-align: center; font-size: 14px; color: var(--vc-muted);">
			Already have an account?
			<a
				href={`${resolve('/login')}${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
				style="color: var(--vc-accent-ink); border-bottom: 1px solid var(--vc-line-2); padding-bottom: 1px;"
			>
				Sign in
			</a>
		</p>
	</div>
</div>
