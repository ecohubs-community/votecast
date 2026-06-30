<script lang="ts">
	// Read-only process-flow diagram for a configured method (task 7.2). Renders the phases a proposal
	// passes through, derived from the method's timing — not an editor.
	interface Props {
		ballotModuleId: string;
		decisionRuleId: string;
		deliberationSeconds: number;
		objectionWindowSeconds: number;
		tallyReveal: 'live' | 'on-close' | 'hidden-forever';
		// When the proposal's actual window is provided, each step shows real dates and the current
		// phase is highlighted (proposal detail). Omit for the abstract method shape (type/create).
		startTime?: Date | string | number;
		endTime?: Date | string | number;
		currentPhase?: string;
	}
	let {
		ballotModuleId,
		decisionRuleId,
		deliberationSeconds,
		objectionWindowSeconds,
		tallyReveal,
		startTime,
		endTime,
		currentPhase
	}: Props = $props();

	function days(seconds: number): string {
		const d = Math.round((seconds / 86_400) * 10) / 10;
		return d >= 1 ? `${d}d` : `${Math.round(seconds / 3600)}h`;
	}
	function ms(v: Date | string | number): number {
		return typeof v === 'number' ? v : new Date(v).getTime();
	}
	function fmt(at: number): string {
		return new Date(at).toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
	const dated = $derived(startTime != null && endTime != null);

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

	const steps = $derived.by(() => {
		// Compute actual phase boundaries when a window is given.
		const start = dated ? ms(startTime!) : 0;
		const end = dated ? ms(endTime!) : 0;
		const range = (from: number, to: number) => `${fmt(from)} → ${fmt(to)}`;

		const out: Array<{ label: string; sub: string; phase: string }> = [];
		if (deliberationSeconds > 0) {
			out.push({
				label: 'Deliberation',
				phase: 'deliberation',
				sub: dated ? range(start - deliberationSeconds * 1000, start) : days(deliberationSeconds)
			});
		}
		out.push({ label: 'Voting', phase: 'voting', sub: dated ? range(start, end) : ballotLabel });
		if (objectionWindowSeconds > 0) {
			out.push({
				label: 'Objection window',
				phase: 'objection-window',
				sub: dated ? range(end, end + objectionWindowSeconds * 1000) : days(objectionWindowSeconds)
			});
		}
		out.push({
			label: 'Result',
			phase: 'finalized',
			sub: dated ? fmt(end + objectionWindowSeconds * 1000) : ruleLabel
		});
		return out;
	});

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
			<li
				class="flow-step"
				class:terminal={i === steps.length - 1}
				class:active={currentPhase === step.phase}
				aria-current={currentPhase === step.phase ? 'step' : undefined}
			>
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
	.flow-step.active {
		border-color: var(--vc-accent);
		box-shadow: 0 0 0 2px var(--vc-accent-soft);
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
