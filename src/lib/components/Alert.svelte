<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'error' | 'success' | 'warn' | 'neutral';

	// Inline notice box. `class` is appended for one-off spacing (e.g. mb-5); other attributes
	// (role, aria-*, …) pass straight through.
	let {
		variant = 'neutral',
		class: cls = '',
		children,
		...rest
	}: {
		variant?: Variant;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	const BASE = 'rounded-[var(--vc-radius-md)] border px-3.5 py-3 text-[14px] leading-normal';
	const VARIANTS: Record<Variant, string> = {
		neutral: 'border-line bg-bg-2 text-ink-2',
		error: 'border-[oklch(0.55_0.16_28/0.25)] bg-danger-soft text-[oklch(0.38_0.14_28)]',
		success: 'border-[oklch(0.55_0.09_150/0.25)] bg-success-soft text-[oklch(0.34_0.08_150)]',
		warn: 'border-[oklch(0.72_0.13_75/0.3)] bg-warning-soft text-[oklch(0.4_0.1_75)]'
	};

	const cx = $derived(`${BASE} ${VARIANTS[variant]} ${cls}`);
</script>

<div class={cx} {...rest}>{@render children?.()}</div>
