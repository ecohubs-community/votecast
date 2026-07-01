<script lang="ts">
	let selected = $state('yes');

	const options = [
		{ id: 'yes', label: 'Yes — adopt the proposal', pct: 64 },
		{ id: 'no', label: 'No — keep current rules', pct: 28 },
		{ id: 'abstain', label: 'Abstain', pct: 8 }
	];
</script>

<div
	class="relative overflow-hidden rounded-[var(--vc-radius-2xl)] border border-line bg-surface p-7 shadow-[var(--vc-shadow-xs),var(--vc-shadow-lg)] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(120%_50%_at_100%_0%,var(--vc-accent-soft),transparent_60%)] before:content-[''] max-[1020px]:max-w-[520px]"
	role="group"
	aria-label="Sample proposal"
>
	<div class="relative mb-[22px] flex items-center justify-between">
		<span class="font-mono text-[11px] tracking-[var(--vc-tracking-eyebrow)] text-muted uppercase">
			Proposal · 014
		</span>
		<span
			class="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent-ink before:size-1.5 before:animate-[vc-pulse_1.8s_infinite] before:rounded-full before:bg-accent before:content-['']"
		>
			Open · 2 days left
		</span>
	</div>
	<h3
		class="relative mb-1.5 font-display text-[length:var(--vc-text-xl)] leading-[1.1] font-normal tracking-[-0.01em]"
	>
		Adopt rotating work-share schedule for the spring season
	</h3>
	<p class="relative mb-[22px] text-[13px] text-muted">41 members eligible · 28 votes cast</p>
	<div class="relative grid gap-2.5">
		{#each options as option (option.id)}
			{@const isSel = selected === option.id}
			<button
				type="button"
				class="flex w-full cursor-pointer items-center gap-3.5 rounded-[var(--vc-radius-lg)] border bg-bg px-4 py-3.5 text-left transition-[border-color,background,transform] duration-[var(--vc-duration-base)] ease-[var(--vc-ease)] {isSel
					? 'border-accent bg-accent-soft'
					: 'border-line hover:border-line-2'}"
				onclick={() => (selected = option.id)}
			>
				<span
					class="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-[border-color] duration-[var(--vc-duration-base)] ease-[var(--vc-ease)] {isSel
						? "border-accent after:size-2 after:rounded-full after:bg-accent after:content-['']"
						: 'border-line-2'}"
					aria-hidden="true"
				></span>
				<span class="text-[15px] font-medium">{option.label}</span>
				<span class="ml-auto font-mono text-[12px] text-muted">{option.pct}%</span>
			</button>
		{/each}
	</div>
</div>
