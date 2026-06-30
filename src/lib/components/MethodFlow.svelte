<script lang="ts">
	// Read-only process-flow diagram for a configured method (task 7.2). Renders the phases a proposal
	// passes through, derived from the method's timing — not an editor.
	import { onMount } from 'svelte';
	import { ballotLabel, ruleLabel, tallyRevealLabel } from '$lib/utils/method-labels';

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

	// When the proposal's live phase is known, each box becomes a progress chip: done steps get a check,
	// the in-flight step a gray hourglass, upcoming steps a faded hourglass, and a reached result a 🎉.
	const showProgress = $derived(currentPhase != null);
	const PHASE_RANK: Record<string, number> = {
		draft: 0,
		deliberation: 1,
		voting: 2,
		'objection-window': 3,
		finalized: 4
	};
	const currentRank = $derived(currentPhase != null ? (PHASE_RANK[currentPhase] ?? -1) : -1);

	// `now` stays 0 until mounted so SSR and first client render agree (no hydration mismatch); then the
	// progress bars animate to their real fill and tick forward each minute.
	let now = $state(0);
	onMount(() => {
		now = Date.now();
		const id = setInterval(() => (now = Date.now()), 60_000);
		return () => clearInterval(id);
	});

	const steps = $derived.by(() => {
		// In dated mode each box shows only its START (= the previous box's end); the final box is the
		// conclusion time. In abstract mode the sub is the duration/method label. `from`/`to` bound each
		// phase's window so a background bar can show how far `now` has progressed through it.
		const start = dated ? ms(startTime!) : 0;
		const end = dated ? ms(endTime!) : 0;
		const delibFrom = start - deliberationSeconds * 1000;
		const objectionTo = end + objectionWindowSeconds * 1000;

		const out: Array<{ label: string; sub: string; phase: string; from: number; to: number }> = [];
		if (deliberationSeconds > 0) {
			out.push({
				label: 'Deliberation',
				phase: 'deliberation',
				sub: dated ? fmt(delibFrom) : days(deliberationSeconds),
				from: delibFrom,
				to: start
			});
		}
		out.push({
			label: 'Voting',
			phase: 'voting',
			sub: dated ? fmt(start) : ballotLabel(ballotModuleId),
			from: start,
			to: end
		});
		if (objectionWindowSeconds > 0) {
			out.push({
				label: 'Objection window',
				phase: 'objection-window',
				sub: dated ? fmt(end) : days(objectionWindowSeconds),
				from: end,
				to: objectionTo
			});
		}
		out.push({
			label: 'Result',
			phase: 'finalized',
			sub: dated ? fmt(objectionTo) : ruleLabel(decisionRuleId),
			from: objectionTo,
			to: objectionTo
		});
		return out;
	});

	const stepViews = $derived(
		steps.map((s, i) => {
			const isTerminal = i === steps.length - 1;
			const rank = PHASE_RANK[s.phase] ?? 0;
			const status: 'idle' | 'done' | 'active' | 'upcoming' = !showProgress
				? 'idle'
				: rank < currentRank
					? 'done'
					: rank === currentRank
						? 'active'
						: 'upcoming';
			const isResult = isTerminal && showProgress && currentRank >= PHASE_RANK.finalized;
			// Fill the box by how far `now` sits through [from, to]; instant phases (result) are 0/100.
			const span = s.to - s.from;
			const progress = !showProgress
				? 0
				: span <= 0
					? rank < currentRank || isResult
						? 100
						: 0
					: Math.max(0, Math.min(1, (now - s.from) / span)) * 100;
			return { ...s, isTerminal, status, isResult, progress };
		})
	);

	const revealLabel = $derived(tallyRevealLabel(tallyReveal));
</script>

<div class="method-flow" aria-label="Method process flow">
	<div class="flow-steps">
		{#each stepViews as step, i (i)}
			{#if i > 0}
				<span class="flow-arrow" aria-hidden="true">→</span>
			{/if}
			<div
				class="flow-step"
				class:terminal={step.isTerminal && !showProgress}
				class:done={step.status === 'done'}
				class:active={step.status === 'active' && !step.isResult}
				class:upcoming={step.status === 'upcoming'}
				class:result={step.isResult}
				aria-current={step.status === 'active' ? 'step' : undefined}
			>
				{#if showProgress}
					<span class="flow-progress" style="width: {step.progress}%" aria-hidden="true"></span>
				{/if}
				{#if step.status !== 'idle'}
					<span class="flow-icon" aria-hidden="true">
						{#if step.isResult}
							🎉
						{:else if step.status === 'done'}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						{:else}
							<!-- pending / in-process: hourglass -->
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M7 3h10M7 21h10M8 3v3.5L12 11l4-4.5V3M8 21v-3.5L12 13l4 4.5V21"
								/>
							</svg>
						{/if}
					</span>
				{/if}
				<span class="flow-label">{step.label}</span>
				<span class="flow-sub">{step.sub}</span>
			</div>
		{/each}
	</div>
	<p class="flow-note">{revealLabel}</p>
</div>

<style>
	.method-flow {
		margin-top: 8px;
	}
	.flow-steps {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin: 0;
		padding: 0;
	}
	.flow-arrow {
		color: var(--vc-muted);
		flex: 0 0 auto;
	}
	.flow-step {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 12px;
		border: 1px solid var(--vc-line);
		border-radius: var(--vc-radius-sm, 8px);
		background: var(--vc-surface);
	}
	/* Progress chips share a corner icon and need room for it. */
	.flow-step.done,
	.flow-step.active,
	.flow-step.upcoming,
	.flow-step.result {
		padding-right: 28px;
	}
	.flow-icon {
		position: absolute;
		z-index: 1;
		top: 5px;
		right: 6px;
		width: 14px;
		height: 14px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		line-height: 1;
	}
	.flow-icon :global(svg) {
		width: 14px;
		height: 14px;
	}
	.flow-step.terminal {
		background: var(--vc-accent-soft, rgba(0, 0, 0, 0.04));
	}
	/* Background progress fill (dated mode): grows left→right with `now` through the phase window. */
	.flow-progress {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 0;
		z-index: 0;
		transition: width 0.4s ease;
	}
	.flow-step.active .flow-progress {
		background: var(--vc-accent-soft, rgba(0, 0, 0, 0.06));
	}
	.flow-step.done .flow-progress,
	.flow-step.result .flow-progress {
		background: var(--vc-success-soft, rgba(34, 160, 100, 0.16));
	}
	.flow-step.upcoming .flow-icon {
		color: var(--vc-muted);
		opacity: 0.55;
	}
	.flow-step.active {
		border-color: var(--vc-accent);
		box-shadow: 0 0 0 2px var(--vc-accent-soft);
	}
	.flow-step.active .flow-icon {
		color: var(--vc-muted);
	}
	.flow-step.done {
		border-color: var(--vc-success-soft, rgba(34, 160, 100, 0.3));
	}
	.flow-step.done .flow-icon {
		color: var(--vc-success-ink, #1a7f53);
	}
	.flow-step.result {
		border-color: var(--vc-success-ink, #1a7f53);
	}
	.flow-label {
		position: relative;
		z-index: 1;
		font-size: 13px;
		font-weight: 600;
		color: var(--vc-ink);
	}
	.flow-sub {
		position: relative;
		z-index: 1;
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
