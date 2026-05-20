<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { resolve } from '$app/paths';

	let { data } = $props();
	let redirectTo = $derived(data.redirectTo);

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let walletLoading = $state(false);
	let hasWallet = $derived(typeof window !== 'undefined' && !!window.ethereum);

	const handleEmailLogin = async (e: SubmitEvent) => {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			const result = await authClient.signIn.email({ email, password });

			if (result.error) {
				error = result.error.message ?? 'Sign-in failed — check your details and try again.';
			} else {
				window.location.href = redirectTo;
			}
		} catch {
			error = 'Something went sideways. Please try again.';
		} finally {
			loading = false;
		}
	};

	const handleWalletConnect = async () => {
		if (!window.ethereum) {
			error = 'No Ethereum wallet detected — install MetaMask to continue.';
			return;
		}

		error = '';
		walletLoading = true;

		try {
			const accounts = (await window.ethereum.request({
				method: 'eth_requestAccounts'
			})) as string[];

			if (!accounts || accounts.length === 0) {
				error = 'No accounts returned from your wallet.';
				return;
			}

			const address = accounts[0];

			const chainIdHex = (await window.ethereum.request({
				method: 'eth_chainId'
			})) as string;
			const chainId = parseInt(chainIdHex, 16);

			const nonceResult = await authClient.siwe.nonce({
				walletAddress: address,
				chainId
			});

			if (nonceResult.error || !nonceResult.data) {
				error = 'Could not get an authentication nonce.';
				return;
			}

			const nonce = nonceResult.data.nonce;

			const domain = window.location.host;
			const origin = window.location.origin;
			const issuedAt = new Date().toISOString();

			const message = [
				`${domain} wants you to sign in with your Ethereum account:`,
				address,
				'',
				'Sign in to VoteCast',
				'',
				`URI: ${origin}`,
				`Version: 1`,
				`Chain ID: ${chainId}`,
				`Nonce: ${nonce}`,
				`Issued At: ${issuedAt}`
			].join('\n');

			const signature = (await window.ethereum.request({
				method: 'personal_sign',
				params: [message, address]
			})) as string;

			const verifyResult = await authClient.siwe.verify({
				message,
				signature,
				walletAddress: address,
				chainId
			});

			if (verifyResult.error) {
				error = verifyResult.error.message ?? 'Wallet verification failed.';
			} else {
				window.location.href = redirectTo;
			}
		} catch (err: unknown) {
			if (
				err &&
				typeof err === 'object' &&
				'code' in err &&
				(err as { code: number }).code === 4001
			) {
				error = 'Wallet connection was rejected.';
			} else {
				error = 'Wallet sign-in failed. Please try again.';
			}
		} finally {
			walletLoading = false;
		}
	};
</script>

<svelte:head>
	<title>Sign in — VoteCast</title>
</svelte:head>

<div class="page-narrow">
	<h1 class="page-title" style="text-align: center;">
		Welcome <em>back.</em>
	</h1>
	<p class="page-sub" style="text-align: center; margin-inline: auto;">
		Sign in to pick up where your communities left off.
	</p>

	<div style="margin-top: 40px;">
		{#if error}
			<div class="alert alert-error" role="alert" style="margin-bottom: 20px;">
				{error}
			</div>
		{/if}

		{#if hasWallet}
			<button onclick={handleWalletConnect} disabled={walletLoading} class="btn btn-ghost btn-lg" style="width: 100%;">
				{#if walletLoading}
					<span class="spinner"></span>
					Connecting your wallet…
				{:else}
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
						<rect x="2" y="6" width="20" height="14" rx="2" />
						<path d="M16 14h.01" />
						<path d="M2 10h20" />
					</svg>
					Continue with wallet
				{/if}
			</button>

			<div class="divider">or sign in with email</div>
		{/if}

		<form onsubmit={handleEmailLogin} class="form-stack">
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
					autocomplete="current-password"
					class="input"
					placeholder="••••••••"
				/>
			</div>

			<button type="submit" disabled={loading} class="btn btn-accent btn-lg" style="width: 100%;">
				{#if loading}
					<span class="spinner"></span>
					Signing in…
				{:else}
					Sign in
				{/if}
			</button>
		</form>

		<p style="margin-top: 28px; text-align: center; font-size: 14px; color: var(--vc-muted);">
			New here?
			<a
				href={`${resolve('/register')}${redirectTo !== '/' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
				style="color: var(--vc-accent-ink); border-bottom: 1px solid var(--vc-line-2); padding-bottom: 1px;"
			>
				Create an account
			</a>
		</p>
	</div>
</div>
