<script lang="ts">
	import type { Snippet } from 'svelte';

	// A person row (member lists, voter lists). `avatarLabel` draws the initials bubble (omit it for
	// rows without an avatar); `name`/`meta`/`trailing` are snippets for the divergent content.
	let {
		avatarLabel = undefined,
		avatarAdmin = false,
		name,
		meta,
		trailing,
		class: cls = ''
	}: {
		avatarLabel?: string;
		avatarAdmin?: boolean;
		name: Snippet;
		meta?: Snippet;
		trailing?: Snippet;
		class?: string;
	} = $props();
</script>

<div class="flex items-center gap-3.5 border-b border-line py-3.5 last:border-b-0 {cls}">
	{#if avatarLabel !== undefined}
		<div
			class="inline-flex size-10 shrink-0 items-center justify-center rounded-full font-display text-[15px] tracking-[0.02em] {avatarAdmin
				? 'bg-accent-soft text-accent-ink'
				: 'bg-bg-2 text-ink'}"
		>
			{avatarLabel}
		</div>
	{/if}

	<div class="min-w-0 flex-1">
		<div class="flex items-center gap-2 text-[15px] font-medium text-ink">
			{@render name()}
		</div>
		{#if meta}
			<div
				class="mt-[3px] flex flex-wrap gap-3 font-mono text-[length:var(--vc-text-xs)] tracking-[var(--vc-tracking-mono)] text-muted"
			>
				{@render meta()}
			</div>
		{/if}
	</div>

	{@render trailing?.()}
</div>
