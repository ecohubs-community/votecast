<script lang="ts">
	// Read-only process-flow diagram for a configured method (task 7.2). Renders the phases a proposal
	// passes through, derived from the method's timing — not an editor.
	interface Props {
		ballotModuleId: string;
		decisionRuleId: string;
		deliberationSeconds: number;
		objectionWindowSeconds: number;
		tallyReveal: 'live' | 'on-close' | 'hidden-forever';
	}
	let {
		ballotModuleId,
		decisionRuleId,
		deliberationSeconds,
		objectionWindowSeconds,
		tallyReveal
	}: Props = $props();

	function days(seconds: number): string {
		const d = Math.round((seconds / 86_400) * 10) / 10;
		return d >= 1 ? `${d}d` : `${Math.round(seconds / 3600)}h`;
	}

	const ballotLabel = $derived(
		(
			{
				'single-choice': 'Single choice',
				consent: 'Consent',
				'multi-question': 'Common Ground'
			} as Record<string, string>
		)[ballotModuleId] ?? ballotModuleId
	);
	const ruleLabel = $derived(
		(
			{
				'simple-majority': 'simple majority',
				'absolute-majority': 'absolute majority',
				'super-majority': 'two-thirds majority',
				consensus: 'consensus',
				'consensus-minus-1': 'consensus −1',
				consent: 'consent',
				'multi-question': 'per-question'
			} as Record<string, string>
		)[decisionRuleId] ?? decisionRuleId
	);

	const steps = $derived([
		...(deliberationSeconds > 0 ? [{ label: 'Deliberation', sub: days(deliberationSeconds) }] : []),
		{ label: 'Voting', sub: ballotLabel },
		...(objectionWindowSeconds > 0
			? [{ label: 'Objection window', sub: days(objectionWindowSeconds) }]
			: []),
		{ label: 'Result', sub: ruleLabel }
	]);

	const revealLabel = $derived(
		(
			{
				live: 'Results visible live',
				'on-close': 'Results after voting closes',
				'hidden-forever': 'Results hidden (facilitators only)'
			} as Record<string, string>
		)[tallyReveal]
	);
</script>

<div class="method-flow" aria-label="Method process flow">
	<ol class="flow-steps">
		{#each steps as step, i (i)}
			<li class="flow-step" class:terminal={i === steps.length - 1}>
				<span class="flow-label">{step.label}</span>
				<span class="flow-sub">{step.sub}</span>
			</li>
		{/each}
	</ol>
	<p class="flow-note">{revealLabel}</p>
</div>

<style>
	.method-flow {
		margin-top: 8px;
	}
	.flow-steps {
		display: flex;
		flex-wrap: wrap;
		align-items: stretch;
		gap: 8px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.flow-step {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 12px;
		border: 1px solid var(--vc-line);
		border-radius: var(--vc-radius-sm, 8px);
		background: var(--vc-surface);
		position: relative;
	}
	.flow-step:not(:last-child)::after {
		content: '→';
		position: absolute;
		right: -12px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--vc-muted);
	}
	.flow-step.terminal {
		background: var(--vc-accent-soft, rgba(0, 0, 0, 0.04));
	}
	.flow-label {
		font-size: 13px;
		font-weight: 600;
		color: var(--vc-ink);
	}
	.flow-sub {
		font-size: 12px;
		color: var(--vc-muted);
		font-family: var(--vc-font-mono, monospace);
	}
	.flow-note {
		margin: 8px 0 0;
		font-size: 12px;
		color: var(--vc-muted);
	}
</style>
