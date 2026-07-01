<script lang="ts">
	// Public / Members radio toggle — the group + globe/lock SVGs were duplicated in create-proposal and
	// settings. `value` is bindable so it drops in for the old `bind:group`.
	let {
		value = $bindable('public'),
		name = 'visibility',
		memberLabel = 'Members'
	}: { value?: 'public' | 'community'; name?: string; memberLabel?: string } = $props();

	const opt =
		'inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--vc-radius-md)] border px-3.5 py-[11px] text-[14px] font-medium transition-[border-color,background,color] duration-[var(--vc-duration-fast)] ease-[var(--vc-ease)]';
	const sel = 'border-accent bg-accent-soft text-accent-ink';
	const unsel = 'border-line bg-surface text-ink-2 hover:border-line-2 hover:bg-bg-2';
</script>

<div class="flex gap-2">
	<label class="{opt} {value === 'public' ? sel : unsel}">
		<input type="radio" {name} value="public" bind:group={value} class="sr-only" />
		<svg
			width="14"
			height="14"
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
	</label>
	<label class="{opt} {value === 'community' ? sel : unsel}">
		<input type="radio" {name} value="community" bind:group={value} class="sr-only" />
		<svg
			width="14"
			height="14"
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
	</label>
</div>
