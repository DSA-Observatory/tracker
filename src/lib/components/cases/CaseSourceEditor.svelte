<script lang="ts">
	import { validateSources, type SourceEntry } from '$lib/case-sources';

	let {
		entries = $bindable(),
		label,
		disabled = false
	}: {
		entries: SourceEntry[];
		label: 'Primary sources' | 'Secondary sources';
		disabled?: boolean;
	} = $props();

	const error = $derived(validateSources(entries));

	function addSource() {
		entries = [...entries, { title: '', url: '' }];
	}

	function removeSource(index: number) {
		entries = entries.filter((_, entryIndex) => entryIndex !== index);
	}

	function needsUrl(entry: SourceEntry) {
		if (!entry.title.trim() && !entry.url.trim()) return false;
		return !(
			entry.original?.legacy &&
			entry.title === entry.original.title &&
			entry.url === entry.original.url
		);
	}

	function removeLabel(entry: SourceEntry, index: number) {
		const description = entry.title.trim() || entry.url.trim();
		return description
			? `Remove source ${index + 1}: ${description}`
			: `Remove source ${index + 1}`;
	}
</script>

<fieldset class="form-control w-full space-y-3" {disabled}>
	<legend class="label-text text-sm font-semibold">{label}</legend>

	{#each entries as entry, index (entry)}
		<div class="rounded-lg border border-base-300 bg-base-100 p-3">
			<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_auto] sm:items-end">
				<label class="form-control w-full">
					<span class="label-text mb-1 text-xs font-medium">Title</span>
					<input
						class="input-bordered input input-sm w-full"
						type="text"
						bind:value={entry.title}
						placeholder="Source title"
					/>
				</label>
				<label class="form-control w-full">
					<span class="label-text mb-1 text-xs font-medium">URL</span>
					<input
						class="input-bordered input input-sm w-full"
						type="url"
						bind:value={entry.url}
						required={needsUrl(entry)}
						placeholder="https://example.com/source"
					/>
				</label>
				<button
					type="button"
					class="btn text-error btn-ghost btn-sm"
					aria-label={removeLabel(entry, index)}
					onclick={() => removeSource(index)}
				>
					Remove
				</button>
			</div>
			{#if entry.original?.legacy && !entry.url}
				<p class="mt-2 text-xs text-base-content/60">
					Legacy source kept as text; add separate linked sources as needed.
				</p>
			{/if}
		</div>
	{/each}

	<button type="button" class="btn w-fit btn-outline btn-sm" onclick={addSource}>Add source</button>

	{#if error}
		<p class="text-xs text-error" aria-live="polite">{error}</p>
	{/if}
</fieldset>
