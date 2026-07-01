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

<div class="mt-2" aria-label="Method process flow">
	<div class="m-0 flex flex-wrap items-center gap-1.5 p-0">
		{#each stepViews as step, i (i)}
			{#if i > 0}
				<span class="flex-none text-muted" aria-hidden="true">→</span>
			{/if}
			{@const box =
				step.status === 'idle'
					? step.isTerminal
						? 'border-line bg-accent-soft'
						: 'border-line'
					: step.isResult
						? 'border-[#1a7f53]'
						: step.status === 'active'
							? 'border-accent shadow-[0_0_0_2px_var(--vc-accent-soft)]'
							: step.status === 'done'
								? 'border-success-soft'
								: 'border-line'}
			{@const iconColor =
				step.status === 'done'
					? 'text-[#1a7f53]'
					: step.status === 'active'
						? 'text-muted'
						: step.status === 'upcoming'
							? 'text-muted opacity-55'
							: ''}
			<div
				class="relative flex flex-col gap-0.5 overflow-hidden rounded-[var(--vc-radius-sm)] border bg-surface py-2 pl-3 {showProgress
					? 'pr-7'
					: 'pr-3'} {box}"
				aria-current={step.status === 'active' ? 'step' : undefined}
			>
				{#if showProgress}
					<span
						class="absolute top-0 bottom-0 left-0 z-0 w-0 transition-[width] duration-[400ms] ease-[ease] {step.status ===
						'active'
							? 'bg-accent-soft'
							: step.status === 'done' || step.isResult
								? 'bg-success-soft'
								: ''}"
						style="width: {step.progress}%"
						aria-hidden="true"
					></span>
				{/if}
				{#if step.status !== 'idle'}
					<span
						class="absolute top-[5px] right-1.5 z-[1] inline-flex size-3.5 items-center justify-center text-[12px] leading-none [&_svg]:size-3.5 {iconColor}"
						aria-hidden="true"
					>
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
				<span class="relative z-[1] text-[13px] font-semibold text-ink">{step.label}</span>
				<span class="relative z-[1] font-mono text-[12px] text-muted">{step.sub}</span>
			</div>
		{/each}
	</div>
	<p class="mt-2 mb-0 text-[12px] text-muted">{revealLabel}</p>
</div>
