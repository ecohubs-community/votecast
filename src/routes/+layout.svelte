<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { authClient } from '$lib/auth-client';
	import type { LayoutData } from './$types';
	import { resolve } from '$app/paths';
	import logo from '$lib/assets/logo.svg';
	import { onMount, type Snippet } from 'svelte';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();
	let mobileMenuOpen = $state(false);
	let avatarMenuOpen = $state(false);
	let scrolled = $state(false);

	onMount(() => {
		const onScroll = () => {
			scrolled = window.scrollY > 8;
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	});

	const handleSignOut = async () => {
		await authClient.signOut();
		window.location.href = '/';
	};

	// Detect synthetic SIWE email (e.g. "0x06d0...@http://localhost:5174")
	const isSyntheticEmail = $derived.by(() => {
		const email = data.user?.email;
		if (!email) return false;
		return /^0x[0-9a-fA-F]+@/.test(email);
	});

	// Real email to display (null for wallet-only users)
	const displayEmail = $derived(isSyntheticEmail ? null : (data.user?.email ?? null));

	// Shortened wallet address (0x1234…abcd)
	const shortWallet = $derived.by(() => {
		const addr = data.user?.walletAddress;
		if (!addr) return null;
		return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
	});

	// Display name: prefer displayName > name (if not a raw address) > shortWallet
	const displayName = $derived.by(() => {
		if (!data.user) return '';
		if (data.user.displayName) return data.user.displayName;
		if (data.user.name && /^0x[0-9a-fA-F]{10,}$/.test(data.user.name)) {
			return shortWallet ?? data.user.name;
		}
		return data.user.name || shortWallet || '';
	});

	// User initials for avatar placeholder
	const initials = $derived.by(() => {
		if (!data.user) return '';
		if (shortWallet && !data.user.displayName && /^0x/.test(data.user.name || '')) {
			return (data.user.walletAddress ?? '0x??').slice(2, 4).toUpperCase();
		}
		const name = data.user.displayName || data.user.name || data.user.email || '';
		const parts = name.trim().split(/\s+/);
		if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
		return name.slice(0, 2).toUpperCase();
	});

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('[data-avatar-menu]')) {
			avatarMenuOpen = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />
<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#0f172a" />
	<meta property="og:site_name" content="VoteCast" />
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="en_US" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<nav class="nav" class:scrolled>
	<div class="nav-inner">
		<a href={resolve('/')} class="brand">
			<img src={logo} alt="" class="brand-logo" />
			VoteCast
		</a>

		<div class="nav-links">
			{#if data.user}
				<a href="#communities" class="nav-link">Communities</a>
				<a href={resolve('/')} class="nav-link">Activity</a>

				<div class="relative" data-avatar-menu>
					<button
						onclick={(e) => {
							e.stopPropagation();
							avatarMenuOpen = !avatarMenuOpen;
						}}
						class="avatar"
						aria-label="User menu"
						aria-expanded={avatarMenuOpen}
						title={displayName}
					>
						{initials}
					</button>

					{#if avatarMenuOpen}
						<div class="avatar-menu">
							<div class="avatar-menu-header">
								<p class="avatar-menu-name">{displayName}</p>
								{#if displayEmail}
									<p class="avatar-menu-email">{displayEmail}</p>
								{/if}
								{#if shortWallet}
									<p class="avatar-menu-wallet">
										<svg
											width="12"
											height="12"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3"
											/>
										</svg>
										{shortWallet}
									</p>
								{/if}
							</div>
							<button onclick={handleSignOut} class="avatar-menu-item">
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
									/>
								</svg>
								Sign out
							</button>
						</div>
					{/if}
				</div>
			{:else}
				<a href="#communities" class="nav-link">Browse</a>
				<a href={resolve('/login')} class="nav-link">Sign in</a>
				<a href={resolve('/register')} class="btn btn-primary">Get started</a>
			{/if}
		</div>

		<button
			onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
			class="mobile-toggle"
			aria-label="Toggle menu"
		>
			{#if mobileMenuOpen}
				<svg
					width="20"
					height="20"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			{:else}
				<svg
					width="20"
					height="20"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
					/>
				</svg>
			{/if}
		</button>
	</div>

	{#if mobileMenuOpen}
		<div class="mobile-menu">
			{#if data.user}
				<div style="display:flex; gap:12px; align-items:center; padding:8px 14px 14px;">
					<div class="avatar">{initials}</div>
					<div style="min-width:0;">
						<p style="margin:0; font-size:14px; font-weight:500; color:var(--vc-ink);">
							{displayName}
						</p>
						{#if displayEmail}
							<p style="margin:2px 0 0; font-size:12px; color:var(--vc-muted);">{displayEmail}</p>
						{/if}
						{#if shortWallet}
							<p
								style="margin:2px 0 0; font-size:11px; color:var(--vc-muted); font-family:var(--vc-font-mono);"
							>
								{shortWallet}
							</p>
						{/if}
					</div>
				</div>
				<a href="#communities" class="nav-link">Communities</a>
				<a href={resolve('/')} class="nav-link">Activity</a>
				<button onclick={handleSignOut} class="nav-link">Sign out</button>
			{:else}
				<a href="#communities" class="nav-link">Browse</a>
				<a href={resolve('/login')} class="nav-link">Sign in</a>
				<a href={resolve('/register')} class="btn btn-primary" style="margin:8px 14px;"
					>Get started</a
				>
			{/if}
		</div>
	{/if}
</nav>

<main>
	{@render children()}
</main>

<footer class="site-footer">
	<div class="wrap footer-inner">
		<div class="brand" style="font-size:18px;">
			<img src={logo} alt="" class="brand-logo" />
			VoteCast
		</div>
		<div class="footer-links">
			<a href={resolve('/')}>Communities</a>
			<a href={resolve('/extensions')}>Extensions</a>
			<a href={resolve('/')}>About</a>
		</div>
		<div class="footer-meta">© {new Date().getFullYear()} · made for real communities</div>
	</div>
</footer>
