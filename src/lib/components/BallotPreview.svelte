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
