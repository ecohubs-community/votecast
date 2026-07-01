<script lang="ts">
	let selected = $state('yes');

	const options = [
		{ id: 'yes', label: 'Yes — adopt the proposal', pct: 64 },
		{ id: 'no', label: 'No — keep current rules', pct: 28 },
		{ id: 'abstain', label: 'Abstain', pct: 8 }
	];
</script>

<div class="ballot" role="group" aria-label="Sample proposal">
	<div class="ballot-head">
		<span class="ballot-tag">Proposal · 014</span>
		<span class="ballot-status">Open · 2 days left</span>
	</div>
	<h3 class="ballot-title">Adopt rotating work-share schedule for the spring season</h3>
	<p class="ballot-sub">41 members eligible · 28 votes cast</p>
	<div class="ballot-options">
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
	/* Landing-page ballot demo — styles live with the only component that uses them. */
	.ballot {
		background: var(--vc-surface);
		border: var(--vc-border);
		border-radius: var(--vc-radius-2xl);
		padding: 28px;
		box-shadow: var(--vc-shadow-xs), var(--vc-shadow-lg);
		position: relative;
		overflow: hidden;
	}
	.ballot::before {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(120% 50% at 100% 0%, var(--vc-accent-soft), transparent 60%);
		pointer-events: none;
	}
	.ballot-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 22px;
		position: relative;
	}
	.ballot-tag {
		font-family: var(--vc-font-mono);
		font-size: 11px;
		letter-spacing: var(--vc-tracking-eyebrow);
		color: var(--vc-muted);
		text-transform: uppercase;
	}
	.ballot-status {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--vc-accent-ink);
		background: var(--vc-accent-soft);
		padding: 4px 10px;
		border-radius: var(--vc-radius-pill);
	}
	.ballot-status::before {
		content: '';
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--vc-accent);
		animation: vc-pulse 1.8s infinite;
	}
	.ballot-title {
		font-family: var(--vc-font-display);
		font-size: var(--vc-text-xl);
		line-height: 1.1;
		font-weight: var(--vc-weight-display);
		letter-spacing: -0.01em;
		margin: 0 0 6px;
		position: relative;
	}
	.ballot-sub {
		font-size: 13px;
		color: var(--vc-muted);
		margin: 0 0 22px;
		position: relative;
	}
	.ballot-options {
		display: grid;
		gap: 10px;
		position: relative;
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
	@media (max-width: 1020px) {
		.ballot {
			max-width: 520px;
		}
	}
</style>
