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
		countryFlag,
		getCategories,
		getThemes,
		getTimeline,
		sourceLinks,
		sourceLabel,
		getSourceText
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
		countryFlag: (country: string) => string;
		getCategories: (record: CaseRecord) => string[];
		getThemes: (record: CaseRecord) => string[];
		getTimeline: (record: CaseRecord) => string;
		sourceLinks: (record: CaseRecord) => string[];
		sourceLabel: (url: string) => string;
		getSourceText: (record: CaseRecord) => string;
	} = $props();
</script>

<table class="min-w-[1280px] border-separate border-spacing-0 text-sm">
	<thead
		class="sticky top-0 z-10 bg-slate-50/95 text-left text-xs font-medium text-slate-500 backdrop-blur"
	>
		<tr>
			<th class="border-b border-slate-200 px-4 py-3">Case</th>
			<th class="border-b border-slate-200 px-4 py-3">Parties</th>
			<th class="border-b border-slate-200 px-4 py-3">Status</th>
			<th class="border-b border-slate-200 px-4 py-3">Jurisdiction</th>
			<th class="border-b border-slate-200 px-4 py-3">Court / Decision</th>
			<th class="border-b border-slate-200 px-4 py-3">Legal tags</th>
			<th class="border-b border-slate-200 px-4 py-3">Timeline</th>
			<th class="border-b border-slate-200 px-4 py-3">Sources</th>
			{#if canWrite}<th class="border-b border-slate-200 px-4 py-3 text-right">Actions</th>{/if}
		</tr>
	</thead>
	<tbody class="text-slate-700">
		{#if loading}
			<tr>
				<td class="px-4 py-6 text-slate-500" colspan={canWrite ? 9 : 8}>Loading cases...</td>
			</tr>
		{:else if filteredCount === 0}
			<tr>
				<td class="px-4 py-6 text-slate-500" colspan={canWrite ? 9 : 8}>No cases found.</td>
			</tr>
		{:else}
			{#if topSpacerHeight > 0}
				<tr aria-hidden="true">
					<td colspan={canWrite ? 9 : 8} style={`height: ${topSpacerHeight}px; padding: 0;`}> </td>
				</tr>
			{/if}
			{#each virtualRows as record (record.id)}
				<tr class="transition hover:bg-slate-50/80" style={`height: ${rowHeight}px;`}>
					<td class="min-w-72 border-b border-slate-100 px-4 py-3 align-top">
						<a
							class="font-semibold tracking-tight text-slate-950 hover:text-slate-700 hover:underline"
							href={resolve(`/cases/${record.id}`)}>{record.title}</a
						>
						<div class="mt-1 font-mono text-xs text-slate-400">
							{record.case_id}{record.ecli ? ` · ${record.ecli}` : ''}
						</div>
						{#if record.summary}
							<div class="mt-2 line-clamp-2 max-w-xl text-sm text-slate-500">
								{@html record.summary}
							</div>
						{/if}
					</td>
					<td class="min-w-52 border-b border-slate-100 px-4 py-3 align-top text-sm">
						{#if record.plaintiffs?.length}
							<div>
								<span class="font-medium text-slate-950">P:</span>
								{record.plaintiffs.join(', ')}
							</div>
						{/if}
						{#if record.defendants?.length}
							<div>
								<span class="font-medium text-slate-950">D:</span>
								{record.defendants.join(', ')}
							</div>
						{/if}
						{#if !record.plaintiffs?.length && !record.defendants?.length}-{/if}
					</td>
					<td class="border-b border-slate-100 px-4 py-3 align-top">
						<span
							class="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 capitalize"
						>
							{record.status}
						</span>
					</td>
					<td class="border-b border-slate-100 px-4 py-3 align-top">
						{#if record.jurisdiction}
							<span class="inline-flex items-center gap-2 whitespace-nowrap">
								{#if countryFlag(record.jurisdiction)}<span>{countryFlag(record.jurisdiction)}</span
									>{/if}
								<span>{record.jurisdiction}</span>
							</span>
						{:else}
							-
						{/if}
					</td>
					<td class="min-w-48 border-b border-slate-100 px-4 py-3 align-top">
						<div class="text-slate-800">{record.court || '-'}</div>
						<div class="text-sm text-slate-500">
							{record.decision_date ? new Date(record.decision_date).toLocaleDateString() : '-'}
						</div>
					</td>
					<td class="min-w-56 border-b border-slate-100 px-4 py-3 align-top">
						<div class="flex flex-wrap gap-1">
							{#each [...(record.dsa_articles ?? []), ...getCategories(record), ...getThemes(record)].slice(0, 5) as tag}
								<span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
									>{tag}</span
								>
							{/each}
						</div>
					</td>
					<td
						class="max-w-sm min-w-64 border-b border-slate-100 px-4 py-3 align-top text-sm text-slate-500"
					>
						{#if getTimeline(record)}
							<div class="line-clamp-3">{getTimeline(record)}</div>
						{:else}
							-
						{/if}
					</td>
					<td class="max-w-sm min-w-64 border-b border-slate-100 px-4 py-3 align-top text-sm">
						{#if sourceLinks(record).length}
							<div class="flex flex-col gap-1">
								{#each sourceLinks(record).slice(0, 3) as link}
									<a
										class="truncate font-medium text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline"
										href={link}
										target="_blank"
										rel="noreferrer"
									>
										{sourceLabel(link)}
									</a>
								{/each}
							</div>
						{:else if getSourceText(record)}
							<div class="line-clamp-3 text-slate-500">{getSourceText(record)}</div>
						{:else}
							-
						{/if}
					</td>
					{#if canWrite}
						<td class="border-b border-slate-100 px-4 py-3 text-right align-top">
							<div class="flex justify-end gap-1">
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
						</td>
					{/if}
				</tr>
			{/each}
			{#if bottomSpacerHeight > 0}
				<tr aria-hidden="true">
					<td colspan={canWrite ? 9 : 8} style={`height: ${bottomSpacerHeight}px; padding: 0;`}>
					</td>
				</tr>
			{/if}
		{/if}
	</tbody>
</table>
