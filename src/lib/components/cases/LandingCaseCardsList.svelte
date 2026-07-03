<script lang="ts">
	import { resolve } from '$app/paths';
	import type { CaseRecord } from '$lib/database';

	let {
		loading,
		filteredCount,
		virtualRows,
		topSpacerHeight,
		bottomSpacerHeight,
		rowHeight,
		canWrite,
		onEdit,
		onDelete,
		getPartyValues,
		countryLabel,
		getCategories,
		getThemes,
		getPrimarySourcesList,
		getSecondarySourcesList,
		sourceLinks,
		sourceLabel
	}: {
		loading: boolean;
		filteredCount: number;
		virtualRows: CaseRecord[];
		topSpacerHeight: number;
		bottomSpacerHeight: number;
		rowHeight: number;
		canWrite: boolean;
		onEdit: (record: CaseRecord) => void;
		onDelete: (record: CaseRecord) => void;
		getPartyValues: (record: CaseRecord) => string[];
		countryLabel: (country: string) => string;
		getCategories: (record: CaseRecord) => string[];
		getThemes: (record: CaseRecord) => string[];
		getPrimarySourcesList: (record: CaseRecord) => string[];
		getSecondarySourcesList: (record: CaseRecord) => string[];
		sourceLinks: (record: CaseRecord) => string[];
		sourceLabel: (url: string) => string;
	} = $props();

	function sourcePreview(value: string) {
		return (
			value
				.replace(/https?:\/\/[^\s)]+/g, '')
				.replace(/[,:;\s]+$/, '')
				.trim() || value
		);
	}

	function legalTags(record: CaseRecord, categories: string[], themes: string[]) {
		return [...categories, ...themes, ...(record.dsa_articles ?? [])].filter(Boolean).slice(0, 7);
	}
</script>

{#if loading}
	<div class="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
		Loading cases...
	</div>
{:else if filteredCount === 0}
	<div class="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
		No cases found.
	</div>
{:else}
	{#if topSpacerHeight > 0}
		<div aria-hidden="true" style={`height: ${topSpacerHeight}px;`}></div>
	{/if}
	<div class="space-y-3">
		{#each virtualRows as record (record.id)}
			{@const categories = getCategories(record)}
			{@const themes = getThemes(record)}
			{@const tags = legalTags(record, categories, themes)}
			{@const primarySources = getPrimarySourcesList(record)}
			{@const secondarySources = getSecondarySourcesList(record)}
			{@const links = sourceLinks(record)}
			{@const parties = getPartyValues(record)}
			<article
				class="group relative rounded-xl border border-slate-100 bg-white p-4 transition duration-200 hover:border-slate-200 hover:bg-slate-50/50 sm:p-5"
				style={`min-height: ${rowHeight - 12}px;`}
			>
				<a
					class="absolute inset-0 z-0 rounded-xl focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:outline-none"
					href={resolve(`/cases/${record.id}`)}
					aria-label={`View case: ${record.title}`}
				></a>
				<div class="pointer-events-none relative z-10 flex h-full flex-col justify-between gap-4">
					<div class="min-w-0">
						<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
							<div class="flex flex-wrap items-center gap-2">
								<span
									class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 capitalize"
								>
									{record.status}
								</span>
								{#if record.published}
									<span
										class="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
									>
										Published
									</span>
								{/if}
							</div>

							{#if canWrite}
								<div
									class="pointer-events-auto flex items-center gap-1 opacity-100 transition lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
								>
									<button
										class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-xs transition hover:bg-slate-50"
										type="button"
										onclick={() => onEdit(record)}
									>
										Edit
									</button>
									<button
										class="inline-flex h-8 items-center rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-600 shadow-xs transition hover:bg-red-50"
										type="button"
										onclick={() => onDelete(record)}
									>
										Delete
									</button>
								</div>
							{/if}
						</div>

						<h2
							class="line-clamp-2 text-lg leading-tight font-bold tracking-tight text-slate-950 group-hover:text-slate-700 sm:text-xl"
						>
							{record.title}
						</h2>

						<div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
							<span
								>{record.jurisdiction
									? countryLabel(record.jurisdiction)
									: 'Jurisdiction not listed'}</span
							>
							<span class="text-slate-300" aria-hidden="true">/</span>
							<span>{record.court || 'Court not listed'}</span>
							{#if record.ecli}
								<span class="hidden text-slate-300 sm:inline" aria-hidden="true">/</span>
								<span class="hidden font-mono text-xs text-slate-400 sm:inline">{record.ecli}</span>
							{/if}
						</div>

						{#if tags.length}
							<div class="mt-4 flex flex-wrap gap-1.5">
								{#each tags as tag}
									<span
										class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700"
									>
										{tag}
									</span>
								{/each}
								{#if categories.length + themes.length + (record.dsa_articles?.length ?? 0) > tags.length}
									<span
										class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500"
									>
										+{categories.length +
											themes.length +
											(record.dsa_articles?.length ?? 0) -
											tags.length}
									</span>
								{/if}
							</div>
						{/if}
					</div>

					<div
						class="grid gap-3 pt-2 text-sm text-slate-600 lg:grid-cols-[minmax(0,1fr)] lg:items-end"
					>
						<div class="min-w-0 space-y-1.5">
							{#if parties.length}
								<p class="line-clamp-1">
									<span class="font-medium text-slate-400">Parties</span>
									<span class="text-slate-200"> / </span>
									<span class="text-slate-900">{parties.join(', ')}</span>
								</p>
							{/if}
							{#if primarySources.length || secondarySources.length}
								<p class="line-clamp-1">
									<span class="font-medium text-slate-400">Source</span>
									<span class="text-slate-200"> / </span>
									<span class="text-slate-900"
										>{sourcePreview(primarySources[0] ?? secondarySources[0])}</span
									>
								</p>
							{:else if links.length}
								<p class="line-clamp-1">
									<span class="font-medium text-slate-400">Source</span>
									<span class="text-slate-200"> / </span>
									<span class="text-slate-900">{sourceLabel(links[0])}</span>
								</p>
							{:else if !parties.length}
								<p class="text-slate-500">No source or party metadata recorded</p>
							{/if}
						</div>
					</div>
				</div>
			</article>
		{/each}
	</div>
	{#if bottomSpacerHeight > 0}
		<div aria-hidden="true" style={`height: ${bottomSpacerHeight}px;`}></div>
	{/if}
{/if}
