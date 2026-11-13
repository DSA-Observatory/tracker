<script lang="ts">
	import { onMount } from 'svelte';
	import { pb, type CaseRecord } from '$lib/database';

	let {
		value = $bindable(),
		caseId,
		disabled = false
	}: {
		value: string[];
		caseId?: string;
		disabled?: boolean;
	} = $props();
	let cases = $state<CaseRecord[]>([]);
	let loading = $state(true);
	let error = $state('');
	let search = $state('');
	const options = $derived(
		cases.filter(
			(item) =>
				item.id !== caseId &&
				!value.includes(item.id) &&
				`${item.case_id} ${item.title}`.toLowerCase().includes(search.toLowerCase())
		)
	);

	async function loadCases() {
		loading = true;
		error = '';
		try {
			cases = await pb
				.collection('cases')
				.getFullList<CaseRecord>({ fields: 'id,case_id,title', sort: 'title' });
		} catch {
			error = 'Could not load available cases.';
		} finally {
			loading = false;
		}
	}
	onMount(loadCases);
</script>

<fieldset class="mt-4 space-y-3" {disabled}>
	<legend class="sr-only">Related cases</legend>
	<p class="text-sm text-base-content/60">
		Link earlier or later instances of this case already in the database.
	</p>
	{#each value as id (id)}
		<div class="flex items-center justify-between gap-3 rounded-lg border border-base-300 p-3">
			<span class="min-w-0 text-sm break-words"
				>{cases.find((item) => item.id === id)?.title ?? id}</span
			>
			<button
				class="btn text-error btn-ghost btn-sm"
				type="button"
				aria-label={`Remove related case ${cases.find((item) => item.id === id)?.title ?? id}`}
				onclick={() => (value = value.filter((item) => item !== id))}>Remove</button
			>
		</div>
	{/each}
	{#if error}
		<p role="alert" class="text-sm text-error">
			{error} <button class="link" type="button" onclick={loadCases}>Retry</button>
		</p>
	{:else if loading}
		<p class="text-sm text-base-content/60" role="status">Loading cases…</p>
	{:else}
		<label class="grid gap-1 text-sm">
			<span>Find a case</span>
			<input
				class="input w-full"
				type="search"
				bind:value={search}
				placeholder="Search by title or case ID"
			/>
		</label>
		<label class="grid gap-1 text-sm">
			<span>Add related case</span>
			<select
				class="select w-full"
				value=""
				onchange={(event) => {
					const id = event.currentTarget.value;
					if (options.some((item) => item.id === id)) value = [...value, id];
					event.currentTarget.value = '';
				}}
			>
				<option value="">{options.length ? 'Choose an existing case' : 'No matching cases'}</option>
				{#each options as item (item.id)}<option value={item.id}
						>{item.case_id} — {item.title}</option
					>{/each}
			</select>
		</label>
	{/if}
</fieldset>
