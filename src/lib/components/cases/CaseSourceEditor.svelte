<script lang="ts">
	import { validateSources, type SourceEntry } from '$lib/case-sources';

	let {
		entries = $bindable(),
		label,
		disabled = false
	}: {
		entries: SourceEntry[];
		label: string;
		disabled?: boolean;
	} = $props();

	const error = $derived(validateSources(entries));
	let draggedIndex = $state<number>();

	function moveSource(from: number, to: number) {
		if (disabled || to < 0 || to >= entries.length || from === to) return;
		const reordered = [...entries];
		const [entry] = reordered.splice(from, 1);
		reordered.splice(to, 0, entry);
		entries = reordered;
	}

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
		<div
			class="rounded-lg border border-base-300 bg-base-100 p-3"
			draggable={!disabled}
			role="group"
			aria-label={`Document ${index + 1}`}
			ondragstart={(event) => {
				draggedIndex = index;
				if (event.dataTransfer) {
					event.dataTransfer.effectAllowed = 'move';
					event.dataTransfer.setData('text/plain', String(index));
				}
			}}
			ondragend={() => (draggedIndex = undefined)}
			ondragover={(event) => {
				if (draggedIndex !== undefined && !disabled) event.preventDefault();
			}}
			ondrop={(event) => {
				if (draggedIndex === undefined) return;
				event.preventDefault();
				moveSource(draggedIndex, index);
				draggedIndex = undefined;
			}}
		>
			<div class="mb-2 flex flex-wrap items-center gap-2 text-xs text-base-content/60">
				<span>Drag to reorder</span>
				<button
					class="btn btn-ghost btn-xs"
					type="button"
					disabled={disabled || index === 0}
					aria-label={`Move document ${index + 1} up`}
					onclick={() => moveSource(index, index - 1)}>↑</button
				>
				<button
					class="btn btn-ghost btn-xs"
					type="button"
					disabled={disabled || index === entries.length - 1}
					aria-label={`Move document ${index + 1} down`}
					onclick={() => moveSource(index, index + 1)}>↓</button
				>
			</div>
			<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_auto] sm:items-end">
				<label class="form-control w-full">
					<span class="label-text mb-1 text-xs font-medium">Title</span>
					<input
						class="input-bordered input input-sm w-full"
						type="text"
						bind:value={entry.title}
						placeholder="Document title"
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

	<button type="button" class="btn w-fit btn-outline btn-sm" onclick={addSource}
		>Add document link</button
	>

	{#if error}
		<p class="text-xs text-error" aria-live="polite">{error}</p>
	{/if}
</fieldset>
