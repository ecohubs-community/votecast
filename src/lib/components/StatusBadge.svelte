<script lang="ts">
	import { PHASE_LABEL, PHASE_VARIANT, type ProposalPhase } from '$lib/utils/phase';

	let { phase }: { phase: ProposalPhase } = $props();
</script>

<span class="vc-badge vc-badge--{PHASE_VARIANT[phase]}">{PHASE_LABEL[phase]}</span>
