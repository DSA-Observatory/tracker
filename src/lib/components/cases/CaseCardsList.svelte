<script lang="ts">
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
		getTimeline,
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
		getTimeline: (record: CaseRecord) => string;
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
</script>

{#if loading}
	<div class="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
		Loading cases...
	</div>
{:else if filteredCount === 0}
	<div class="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
		No cases found.
	</div>
{:else}
	{#if topSpacerHeight > 0}
		<div aria-hidden="true" style={`height: ${topSpacerHeight}px;`}></div>
	{/if}
	<div class="space-y-2.5">
		{#each virtualRows as record (record.id)}
			{@const categories = getCategories(record)}
			{@const themes = getThemes(record)}
			{@const primarySources = getPrimarySourcesList(record)}
			{@const secondarySources = getSecondarySourcesList(record)}
			{@const links = sourceLinks(record)}
			{@const parties = getPartyValues(record)}
			{@const timeline = getTimeline(record)}
			<article
				class="group rounded-sm border border-slate-200 bg-white p-4 shadow-xs shadow-slate-200/40 transition duration-200 hover:border-slate-300"
				style={`min-height: ${rowHeight - 12}px;`}
			>
				<div class="flex h-full flex-col gap-4">
					<div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
						<div class="min-w-0 flex-1">
							<div class="mb-2 flex flex-wrap items-center gap-2">
								<span
									class="rounded-sm border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-600 capitalize"
								>
									{record.status}
								</span>
								{#if record.published}
									<span
										class="rounded-sm border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700"
									>
										Published
									</span>
								{/if}
							</div>
							<h3
								class="line-clamp-2 text-lg leading-tight font-semibold tracking-tight text-slate-950"
							>
								{record.title}
							</h3>
							<div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
								<span
									>{record.jurisdiction
										? countryLabel(record.jurisdiction)
										: 'Jurisdiction not listed'}</span
								>
								<span class="text-slate-300" aria-hidden="true">/</span>
								<span>{record.court || 'Court not listed'}</span>
								{#if record.ecli}
									<span class="text-slate-300" aria-hidden="true">/</span>
									<span class="font-mono text-xs text-slate-500">{record.ecli}</span>
								{/if}
							</div>
						</div>
						{#if canWrite}
							<div
								class="flex items-center gap-1 opacity-100 transition lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
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

					<div
						class="grid gap-3 text-sm lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)]"
					>
						<section class="min-w-0 rounded-sm border border-slate-100 bg-slate-50/40 p-3">
							<div class="text-[0.72rem] font-medium text-slate-400">Legal focus</div>
							{#if record.dsa_articles?.length}
								<div class="mt-2 flex flex-wrap gap-1.5">
									{#each record.dsa_articles.slice(0, 4) as article}
										<span
											class="max-w-full rounded-sm border border-slate-200 bg-white px-1.5 py-0.5 text-[0.82rem] leading-5 font-medium text-slate-800"
										>
											{article}
										</span>
									{/each}
									{#if record.dsa_articles.length > 4}
										<span
											class="rounded-sm border border-slate-200 bg-white px-1.5 py-0.5 text-[0.82rem] leading-5 font-medium text-slate-500"
										>
											+{record.dsa_articles.length - 4}
										</span>
									{/if}
								</div>
							{:else}
								<p class="mt-2 text-[0.95rem] text-slate-500">No DSA article tagged</p>
							{/if}
							<div class="mt-3 space-y-1.5">
								<p class="line-clamp-1 text-[0.95rem] text-slate-900">
									<span class="text-xs font-normal text-slate-400">Category</span>
									<span class="text-slate-200"> / </span>
									<span>{categories.length ? categories.join(', ') : 'Not classified'}</span>
								</p>
								<p class="line-clamp-1 text-[0.95rem] text-slate-900">
									<span class="text-xs font-normal text-slate-400">Theme</span>
									<span class="text-slate-200"> / </span>
									<span>{themes.length ? themes.join(', ') : 'Not classified'}</span>
								</p>
							</div>
						</section>

						<section class="min-w-0 rounded-sm border border-slate-100 bg-white p-3">
							<div class="flex items-center justify-between gap-2">
								<div class="text-[0.72rem] font-medium text-slate-400">Sources</div>
								{#if links.length}
									<a
										class="text-xs font-medium text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline"
										href={links[0]}
										target="_blank"
										rel="noreferrer"
									>
										Open{links.length > 1 ? ` +${links.length - 1}` : ''}
									</a>
								{/if}
							</div>
							<div class="mt-2 space-y-1.5 text-[0.95rem] text-slate-900">
								{#if primarySources.length}
									<p class="line-clamp-1">
										<span class="text-xs font-normal text-slate-400">Primary</span>
										<span class="text-slate-200"> / </span>
										<span>{sourcePreview(primarySources[0])}</span>
									</p>
								{/if}
								{#if secondarySources.length}
									<p class="line-clamp-1">
										<span class="text-xs font-normal text-slate-400">Secondary</span>
										<span class="text-slate-200"> / </span>
										<span>{sourcePreview(secondarySources[0])}</span>
									</p>
								{/if}
								{#if !primarySources.length && !secondarySources.length && links.length}
									<p class="line-clamp-1">
										<span class="text-xs font-normal text-slate-400">Linked source</span>
										<span class="text-slate-200"> / </span>
										<span>{sourceLabel(links[0])}</span>
									</p>
								{/if}
								{#if !primarySources.length && !secondarySources.length && !links.length}
									<p class="text-slate-500">No source recorded</p>
								{/if}
							</div>
						</section>

						<section class="min-w-0 rounded-sm border border-slate-100 bg-white p-3">
							<div class="text-[0.72rem] font-medium text-slate-400">Context</div>
							<div class="mt-2 space-y-1.5 text-[0.95rem] text-slate-900">
								{#if parties.length}
									<p class="line-clamp-1">
										<span class="text-xs font-normal text-slate-400">Parties</span>
										<span class="text-slate-200"> / </span>
										<span>{parties.join(', ')}</span>
									</p>
								{/if}
								{#if timeline}
									<p class="line-clamp-2">
										<span class="text-xs font-normal text-slate-400">Timeline</span>
										<span class="text-slate-200"> / </span>
										<span>{sourcePreview(timeline)}</span>
									</p>
								{:else if !parties.length}
									<p class="text-slate-500">No contextual metadata</p>
								{/if}
							</div>
							<div class="mt-3 truncate font-mono text-[0.66rem] text-slate-300">
								{record.case_id}
							</div>
						</section>
					</div>
				</div>
			</article>
		{/each}
	</div>
	{#if bottomSpacerHeight > 0}
		<div aria-hidden="true" style={`height: ${bottomSpacerHeight}px;`}></div>
	{/if}
{/if}
