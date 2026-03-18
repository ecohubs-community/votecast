<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let choices = $state<string[]>(['', '']);
	let visibility = $state<'public' | 'community'>('public');

	// Default times: start = now, end = now + 3 days
	const now = new Date();
	now.setSeconds(0, 0);
	const defaultStartTime = now.toISOString().slice(0, 16);
	const endDate = new Date(now.getTime());
	endDate.setDate(endDate.getDate() + 3);
	const defaultEndTime = endDate.toISOString().slice(0, 16);

	$effect(() => {
		if (form?.choices?.length) {
			choices = [...form.choices];
		}
		if (form?.visibility) {
			visibility = form.visibility as 'public' | 'community';
		}
	});

	function addChoice() {
		if (choices.length < 20) {
			choices = [...choices, ''];
		}
	}

	function removeChoice(index: number) {
		if (choices.length > 2) {
			choices = choices.filter((_, i) => i !== index);
		}
	}
</script>

<svelte:head>
	<title>Create Proposal — {data.community.name} — LumiVote</title>
</svelte:head>

<div class="mb-6">
	<a
		href="/communities/{data.community.slug}"
		class="text-sm text-blue-600 hover:text-blue-800"
	>
		&larr; Back to {data.community.name}
	</a>
</div>

<h1 class="text-2xl font-bold text-gray-900 sm:text-3xl">Create Proposal</h1>
<p class="mt-1 text-sm text-gray-600">For {data.community.name}</p>

{#if form?.error}
	<div class="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
		{form.error}
	</div>
{/if}

<form method="POST" use:enhance class="mt-6">
	<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
		<!-- Left column: Title + Description -->
		<div class="space-y-6 lg:col-span-2">
			<!-- Title -->
			<div>
				<label for="title" class="block text-sm font-medium text-gray-700">Title</label>
				<input
					type="text"
					id="title"
					name="title"
					required
					maxlength="200"
					value={form?.title ?? ''}
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					placeholder="What should the community decide?"
				/>
			</div>

			<!-- Description -->
			<div>
				<label for="body" class="block text-sm font-medium text-gray-700">Description</label>
				<textarea
					id="body"
					name="body"
					required
					rows="12"
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
					placeholder="Provide context and details about this proposal..."
				>{form?.body ?? ''}</textarea>
			</div>
		</div>

		<!-- Right column: Visibility + Times + Choices -->
		<div class="space-y-6">
			<!-- Visibility -->
			<div>
				<span class="block text-sm font-medium text-gray-700">Visibility</span>
				<div class="mt-2 flex gap-2">
					<label
						class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors
						{visibility === 'public'
							? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
							: 'border-gray-200 text-gray-600 hover:bg-gray-50'}"
					>
						<input type="radio" name="visibility" value="public" bind:group={visibility} class="sr-only" />
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.466.732-3.558" />
						</svg>
						Public
					</label>
					<label
						class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors
						{visibility === 'community'
							? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500'
							: 'border-gray-200 text-gray-600 hover:bg-gray-50'}"
					>
						<input type="radio" name="visibility" value="community" bind:group={visibility} class="sr-only" />
						<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
						</svg>
						Internal
					</label>
				</div>
				<p class="mt-1.5 text-xs text-gray-400">
					{visibility === 'public'
						? 'Anyone can view this proposal and its results, even non-members.'
						: 'Only community members can view this proposal.'}
				</p>
			</div>

			<!-- Start time -->
			<div>
				<label for="startTime" class="block text-sm font-medium text-gray-700">Start time</label>
				<input
					type="datetime-local"
					id="startTime"
					name="startTime"
					required
					value={form?.startTime ?? defaultStartTime}
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				/>
			</div>

			<!-- End time -->
			<div>
				<label for="endTime" class="block text-sm font-medium text-gray-700">End time</label>
				<input
					type="datetime-local"
					id="endTime"
					name="endTime"
					required
					value={form?.endTime ?? defaultEndTime}
					class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
				/>
			</div>

			<!-- Choices -->
			<div>
				<span class="block text-sm font-medium text-gray-700">Choices (min 2, max 20)</span>
				<div class="mt-2 space-y-2">
					{#each choices as choice, i}
						<div class="flex items-center gap-2">
							<input
								type="text"
								name="choices"
								required
								maxlength="200"
								bind:value={choices[i]}
								class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								placeholder="Choice {i + 1}"
							/>
							{#if choices.length > 2}
								<button
									type="button"
									onclick={() => removeChoice(i)}
									class="shrink-0 rounded-md px-2 py-2 text-sm text-red-600 hover:bg-red-50"
								>
									Remove
								</button>
							{/if}
						</div>
					{/each}
				</div>
				{#if choices.length < 20}
					<button
						type="button"
						onclick={addChoice}
						class="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800"
					>
						+ Add choice
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Submit -->
	<div class="mt-8 border-t border-gray-200 pt-6">
		<button
			type="submit"
			class="rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
		>
			Create Proposal
		</button>
	</div>
</form>
