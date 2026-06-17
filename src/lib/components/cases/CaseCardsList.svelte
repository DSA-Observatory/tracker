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
		caseTags,
		formatDate,
		sourceLinks,
		sourceText
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
		caseTags: (record: CaseRecord) => string[];
		formatDate: (value?: string) => string;
		sourceLinks: (record: CaseRecord) => string[];
		sourceText: (record: CaseRecord) => string;
	} = $props();
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
			<article
				class="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 transition duration-200 hover:border-slate-300 hover:shadow-md hover:shadow-slate-200/80"
				style={`min-height: ${rowHeight - 12}px;`}
			>
				<div>
					<div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
						<div class="min-w-0 flex-1">
							<div class="mb-2 flex flex-wrap items-center gap-2">
								<span class="font-mono text-xs text-slate-400">{record.case_id}</span>
								<span
									class="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 capitalize"
								>
									{record.status}
								</span>
								{#if record.published}
									<span
										class="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
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
							{#if record.ecli}
								<p class="mt-1 text-sm text-slate-500">{record.ecli}</p>
							{/if}
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

					<div class="mt-3 grid gap-3 text-sm lg:grid-cols-[1.25fr_1fr_auto]">
						<div class="min-w-0 space-y-1 text-slate-600">
							{#if record.plaintiffs?.length || record.defendants?.length}
								<div class="line-clamp-1">
									<span class="font-medium text-slate-900">Parties</span>
									<span class="text-slate-300">/</span>
									{getPartyValues(record).join(', ')}
								</div>
							{/if}
							<div class="line-clamp-1">
								<span class="font-medium text-slate-900">Jurisdiction</span>
								<span class="text-slate-300">/</span>
								{record.jurisdiction ? countryLabel(record.jurisdiction) : '-'}
								<span class="mx-1.5 text-slate-300">/</span>
								<span class="font-medium text-slate-900">Court</span>
								<span class="text-slate-300">/</span>
								{record.court || '-'}
							</div>
						</div>
						<div class="flex min-w-0 flex-wrap content-start gap-1.5">
							{#each caseTags(record).slice(0, 4) as tag}
								<span
									class="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
								>
									{tag}
								</span>
							{/each}
						</div>
						<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 lg:justify-end">
							<span>{formatDate(record.decision_date)}</span>
							{#if sourceLinks(record).length}
								<a
									class="font-medium text-slate-600 no-underline hover:text-slate-950"
									href={sourceLinks(record)[0]}
									target="_blank"
									rel="noreferrer"
								>
									{sourceText(record)}
								</a>
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
