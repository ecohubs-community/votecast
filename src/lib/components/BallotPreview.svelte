<script lang="ts">
	let selected = $state('yes');

	const options = [
		{ id: 'yes', label: 'Yes — adopt the proposal', pct: 64 },
		{ id: 'no', label: 'No — keep current rules', pct: 28 },
		{ id: 'abstain', label: 'Abstain', pct: 8 }
	];
</script>

<div
	class="ballot relative overflow-hidden rounded-[var(--vc-radius-2xl)] border border-line bg-surface p-7 shadow-[var(--vc-shadow-xs),var(--vc-shadow-lg)] max-[1020px]:max-w-[520px]"
	role="group"
	aria-label="Sample proposal"
>
	<div class="relative mb-[22px] flex items-center justify-between">
		<span class="font-mono text-[11px] tracking-[var(--vc-tracking-eyebrow)] text-muted uppercase">
			Proposal · 014
		</span>
		<span
			class="ballot-status inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent-ink"
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
			<button
				type="button"
				class="ballot-opt"
				class:selected={selected === option.id}
				onclick={() => (selected = option.id)}
			>
				<span class="radio" aria-hidden="true"></span>
				<span class="label">{option.label}</span>
				<span class="pct">{option.pct}%</span>
			</button>
		{/each}
	</div>
</div>

<style>
	/* Only the bits utilities can't express cleanly: a radial-gradient sheen, the pulsing status dot,
	   and the interactive option + radio (state-driven child + ::after fill). */
	.ballot::before {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(120% 50% at 100% 0%, var(--vc-accent-soft), transparent 60%);
		pointer-events: none;
	}
	.ballot-status::before {
		content: '';
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--vc-accent);
		animation: vc-pulse 1.8s infinite;
	}
	.ballot-opt {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		border: var(--vc-border);
		border-radius: var(--vc-radius-lg);
		background: var(--vc-bg);
		transition:
			border-color var(--vc-duration-base) var(--vc-ease),
			background var(--vc-duration-base) var(--vc-ease),
			transform var(--vc-duration-fast) var(--vc-ease);
		cursor: pointer;
		font: inherit;
		color: inherit;
		text-align: left;
		width: 100%;
	}
	.ballot-opt:hover {
		border-color: var(--vc-line-2);
	}
	.ballot-opt.selected {
		border-color: var(--vc-accent);
		background: var(--vc-accent-soft);
	}
	.ballot-opt .radio {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: 1.5px solid var(--vc-line-2);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: border-color var(--vc-duration-base) var(--vc-ease);
	}
	.ballot-opt.selected .radio {
		border-color: var(--vc-accent);
	}
	.ballot-opt.selected .radio::after {
		content: '';
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--vc-accent);
	}
	.ballot-opt .label {
		font-size: 15px;
		font-weight: var(--vc-weight-medium);
	}
	.ballot-opt .pct {
		margin-left: auto;
		font-family: var(--vc-font-mono);
		font-size: 12px;
		color: var(--vc-muted);
	}
</style>
