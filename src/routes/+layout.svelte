<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { authClient } from '$lib/auth-client';
	import type { LayoutData } from './$types';
	import { resolve } from '$app/paths';
	import logo from '$lib/assets/logo.png';

	let { data, children }: { data: LayoutData; children: any } = $props();
	let mobileMenuOpen = $state(false);
	let avatarMenuOpen = $state(false);

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
	const displayEmail = $derived(isSyntheticEmail ? null : data.user?.email ?? null);

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
		// If name is a raw wallet address, prefer the shortened version
		if (data.user.name && /^0x[0-9a-fA-F]{10,}$/.test(data.user.name)) {
			return shortWallet ?? data.user.name;
		}
		return data.user.name || shortWallet || '';
	});

	// User initials for avatar placeholder
	const initials = $derived.by(() => {
		if (!data.user) return '';
		// For wallet-only users, use first 2 hex chars after "0x"
		if (shortWallet && !data.user.displayName && /^0x/.test(data.user.name || '')) {
			return (data.user.walletAddress ?? '0x??').slice(2, 4).toUpperCase();
		}
		const name = data.user.displayName || data.user.name || data.user.email || '';
		const parts = name.trim().split(/\s+/);
		if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
		return name.slice(0, 2).toUpperCase();
	});

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('[data-avatar-menu]')) {
			avatarMenuOpen = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />
<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<nav class="border-b border-gray-200 bg-white px-4 py-3">
	<div class="mx-auto flex max-w-5xl items-center justify-between">
		<a href={resolve("/")} class="text-lg font-semibold text-gray-900 flex gap-1 items-center">
			<img src={logo} alt="LumiVote" class="h-5 w-5" />
			LumiVote
		</a>

		<!-- Desktop nav -->
		<div class="hidden items-center gap-4 sm:flex">
			{#if data.user}
				<a href={resolve("/")} class="text-sm text-gray-600 hover:text-gray-900">Communities</a>

				<!-- Avatar + Dropdown -->
				<div class="relative" data-avatar-menu>
					<button
						onclick={(e) => { e.stopPropagation(); avatarMenuOpen = !avatarMenuOpen; }}
						class="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white ring-2 ring-transparent transition-shadow hover:ring-blue-200 focus:ring-blue-300 focus:outline-none"
						aria-label="User menu"
						aria-expanded={avatarMenuOpen}
					>
						{initials}
					</button>

					{#if avatarMenuOpen}
						<div
							class="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
						>
							<!-- User info -->
							<div class="border-b border-gray-100 px-4 py-3">
								<p class="text-sm font-medium text-gray-900">
									{displayName}
								</p>
								{#if displayEmail}
									<p class="mt-0.5 truncate text-xs text-gray-500">{displayEmail}</p>
								{/if}
								{#if shortWallet}
									<p class="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
										<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
										</svg>
										{shortWallet}
									</p>
								{/if}
							</div>
							<!-- Actions -->
							<button
								onclick={handleSignOut}
								class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
							>
								<svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
								</svg>
								Sign out
							</button>
						</div>
					{/if}
				</div>
			{:else}
				<a href={resolve("/login")} class="text-sm text-gray-600 hover:text-gray-900">Sign in</a>
				<a
					href={resolve("/register")}
					class="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
				>
					Register
				</a>
			{/if}
		</div>

		<!-- Mobile hamburger -->
		<button
			onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
			class="inline-flex items-center justify-center rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 sm:hidden"
			aria-label="Toggle menu"
		>
			{#if mobileMenuOpen}
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			{:else}
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
				</svg>
			{/if}
		</button>
	</div>

	<!-- Mobile dropdown -->
	{#if mobileMenuOpen}
		<div class="mx-auto mt-3 max-w-5xl space-y-2 border-t border-gray-100 pt-3 sm:hidden">
			{#if data.user}
				<!-- User info -->
				<div class="flex items-center gap-3 px-1 py-1">
					<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
						{initials}
					</div>
					<div class="min-w-0">
						<p class="truncate text-sm font-medium text-gray-900">
							{displayName}
						</p>
						{#if displayEmail}
							<p class="truncate text-xs text-gray-500">{displayEmail}</p>
						{/if}
						{#if shortWallet}
							<p class="truncate text-xs text-gray-400">{shortWallet}</p>
						{/if}
					</div>
				</div>

				<hr class="border-gray-100" />
				<a href={resolve("/")} class="block rounded-md px-1 py-1.5 text-sm text-gray-600 hover:bg-gray-50">Communities</a>
				<button
					onclick={handleSignOut}
					class="block w-full rounded-md px-1 py-1.5 text-left text-sm text-gray-500 hover:bg-gray-50"
				>
					Sign out
				</button>
			{:else}
				<a href={resolve("/login")} class="block rounded-md px-1 py-1.5 text-sm text-gray-600 hover:bg-gray-50">Sign in</a>
				<a href={resolve("/register")} class="block rounded-md px-1 py-1.5 text-sm font-medium text-blue-600 hover:bg-gray-50">Register</a>
			{/if}
		</div>
	{/if}
</nav>

<main class="mx-auto max-w-5xl p-4">
	{@render children()}
</main>

<footer class="mt-12 border-t border-gray-200 px-4 py-6 text-center text-xs text-gray-400">
	&copy; {new Date().getFullYear()} LumiVote &middot; Community Governance, Simplified
</footer>
