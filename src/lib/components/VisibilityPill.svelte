<script lang="ts">
	// The Public / Members pill — its globe/lock SVG was duplicated across ProposalCard, the proposal
	// detail, the community page and settings. One place now.
	let {
		visibility,
		memberLabel = 'Members only'
	}: { visibility: 'public' | 'community'; memberLabel?: string } = $props();
</script>

<span class="meta-pill" title={visibility === 'public' ? 'Public' : memberLabel}>
	{#if visibility === 'public'}
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="9" />
			<path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
		</svg>
		Public
	{:else}
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.8"
			aria-hidden="true"
		>
			<rect x="4" y="11" width="16" height="10" rx="2" />
			<path d="M8 11V7a4 4 0 0 1 8 0v4" />
		</svg>
		{memberLabel}
	{/if}
</span>
