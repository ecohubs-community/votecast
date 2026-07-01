<script lang="ts">
	import type { Snippet } from 'svelte';

	type Variant = 'primary' | 'accent' | 'ghost' | 'danger' | 'destructive';
	type Size = 'sm' | 'md' | 'lg';

	// Renders an <a> when `href` is set, otherwise a <button>. Extra attributes (onclick, disabled,
	// type, aria-*, style, …) pass straight through; `class` is appended for one-off tweaks.
	let {
		variant = 'ghost',
		size = 'md',
		href = undefined,
		class: cls = '',
		children,
		...rest
	}: {
		variant?: Variant;
		size?: Size;
		href?: string;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	const BASE =
		'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border-0 px-[18px] py-2.5 text-[14px] font-medium no-underline transition-[transform,background,color,border-color] duration-[var(--vc-duration-fast)] ease-[var(--vc-ease)] active:translate-y-px disabled:cursor-not-allowed';
	const VARIANTS: Record<Variant, string> = {
		primary:
			'bg-ink text-bg hover:bg-[color-mix(in_oklab,var(--vc-ink)_88%,var(--vc-accent))] disabled:opacity-50',
		accent: 'bg-accent text-white hover:bg-accent-strong disabled:opacity-50',
		ghost:
			'border border-line-2 bg-transparent text-ink hover:border-ink-2 hover:bg-bg-2 disabled:opacity-55',
		danger:
			'border border-danger-line bg-transparent text-[oklch(0.5_0.16_28)] hover:border-[oklch(0.55_0.16_28/0.5)] hover:bg-danger-soft disabled:opacity-55',
		destructive:
			'bg-[oklch(0.5_0.16_28)] text-white hover:bg-[oklch(0.42_0.16_28)] disabled:bg-line disabled:text-muted'
	};
	const SIZES: Record<Size, string> = {
		sm: 'px-3.5 py-[7px] text-[13px]',
		md: '',
		lg: 'px-6 py-3.5 text-[15px]'
	};

	const cx = $derived(`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${cls}`);
</script>

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href is supplied already-resolved by the caller -->
	<a {href} class={cx} {...rest}>{@render children?.()}</a>
{:else}
	<button type="button" class={cx} {...rest}>{@render children?.()}</button>
{/if}
