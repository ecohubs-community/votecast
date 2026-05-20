<script lang="ts">
	type Props = {
		status: 'draft' | 'active' | 'closed';
	};

	let { status }: Props = $props();

	const labels: Record<string, string> = {
		draft: 'Draft',
		active: 'Open',
		closed: 'Closed'
	};
</script>

<span class="vc-badge vc-badge--{status}">{labels[status]}</span>
