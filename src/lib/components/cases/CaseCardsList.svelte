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
	<div class="border border-base-300/70 bg-base-100/80 p-6 shadow-sm backdrop-blur-xl">
		Loading cases...
	</div>
{:else if filteredCount === 0}
	<div class="border border-base-300/70 bg-base-100/80 p-6 shadow-sm backdrop-blur-xl">
		No cases found.
	</div>
{:else}
	{#if topSpacerHeight > 0}
		<div aria-hidden="true" style={`height: ${topSpacerHeight}px;`}></div>
	{/if}
	<div class="space-y-3">
		{#each virtualRows as record (record.id)}
			<article
				class="rounded-md border border-base-300/70 bg-base-100/90 p-4 shadow-sm backdrop-blur-xl transition duration-200 hover:border-primary/30 hover:shadow-md"
				style={`min-height: ${rowHeight - 12}px;`}
			>
				<div>
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="min-w-0 flex-1">
							<div class="mb-2 flex flex-wrap items-center gap-1.5">
								<span class="badge badge-outline badge-primary">{record.case_id}</span>
								<span class="badge badge-outline badge-sm capitalize">{record.status}</span>
								{#if record.published}<span class="badge badge-outline badge-success"
										>Published</span
									>{/if}
							</div>
							<h3 class="line-clamp-2 text-lg leading-tight font-black text-base-content">
								{record.title}
							</h3>
							{#if record.ecli}
								<p class="mt-1 text-sm text-base-content/60">{record.ecli}</p>
							{/if}
						</div>
						{#if canWrite}
							<div class="join">
								<button class="btn join-item btn-sm" type="button" onclick={() => onEdit(record)}>
									Edit
								</button>
								<button
									class="btn join-item btn-sm btn-error"
									type="button"
									onclick={() => onDelete(record)}
								>
									Delete
								</button>
							</div>
						{/if}
					</div>

					<div class="mt-3 grid gap-3 text-sm lg:grid-cols-[1.35fr_1fr_auto]">
						<div class="min-w-0 space-y-1 text-base-content/75">
							{#if record.plaintiffs?.length || record.defendants?.length}
								<div class="line-clamp-1">
									<span class="font-semibold text-base-content">Parties:</span>
									{getPartyValues(record).join(', ')}
								</div>
							{/if}
							<div class="line-clamp-1">
								<span class="font-semibold text-base-content">Jurisdiction:</span>
								{record.jurisdiction ? countryLabel(record.jurisdiction) : '-'}
								<span class="mx-1.5 text-base-content/30">/</span>
								<span class="font-semibold text-base-content">Court:</span>
								{record.court || '-'}
							</div>
						</div>
						<div class="flex min-w-0 flex-wrap content-start gap-1.5">
							{#each caseTags(record).slice(0, 4) as tag}
								<span class="badge badge-ghost">{tag}</span>
							{/each}
						</div>
						<div
							class="flex flex-wrap items-center gap-x-3 gap-y-1 text-base-content/70 lg:justify-end"
						>
							<span>{formatDate(record.decision_date)}</span>
							{#if sourceLinks(record).length}
								<a
									class="text-base-content/70 no-underline hover:text-primary"
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
