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
		countryFlag,
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
		getTimeline: (record: CaseRecord) => string;
		sourceLinks: (record: CaseRecord) => string[];
		sourceLabel: (url: string) => string;
		getSourceText: (record: CaseRecord) => string;
	} = $props();
</script>

<table class="table min-w-[1280px] table-zebra">
	<thead class="bg-base-200 shadow-sm">
		<tr>
			<th>Case</th>
			<th>Parties</th>
			<th>Status</th>
			<th>Jurisdiction</th>
			<th>Court / Decision</th>
			<th>Legal tags</th>
			<th>Timeline</th>
			<th>Sources</th>
			{#if canWrite}<th class="text-right">Actions</th>{/if}
		</tr>
	</thead>
	<tbody>
		{#if loading}
			<tr>
				<td colspan={canWrite ? 9 : 8}>Loading cases...</td>
			</tr>
		{:else if filteredCount === 0}
			<tr>
				<td colspan={canWrite ? 9 : 8}>No cases found.</td>
			</tr>
		{:else}
			{#if topSpacerHeight > 0}
				<tr aria-hidden="true">
					<td colspan={canWrite ? 9 : 8} style={`height: ${topSpacerHeight}px; padding: 0;`}> </td>
				</tr>
			{/if}
			{#each virtualRows as record (record.id)}
				<tr style={`height: ${rowHeight}px;`}>
					<td class="min-w-72">
						<div class="font-bold">{record.title}</div>
						<div class="text-sm text-base-content/60">
							{record.case_id}{record.ecli ? ` · ${record.ecli}` : ''}
						</div>
						{#if record.summary}
							<div class="mt-2 line-clamp-2 max-w-xl text-sm text-base-content/70">
								{@html record.summary}
							</div>
						{/if}
					</td>
					<td class="min-w-52 text-sm">
						{#if record.plaintiffs?.length}
							<div><span class="font-semibold">P:</span> {record.plaintiffs.join(', ')}</div>
						{/if}
						{#if record.defendants?.length}
							<div><span class="font-semibold">D:</span> {record.defendants.join(', ')}</div>
						{/if}
						{#if !record.plaintiffs?.length && !record.defendants?.length}-{/if}
					</td>
					<td><span class="badge badge-outline">{record.status}</span></td>
					<td>
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
					<td class="min-w-48">
						<div>{record.court || '-'}</div>
						<div class="text-sm text-base-content/60">
							{record.decision_date ? new Date(record.decision_date).toLocaleDateString() : '-'}
						</div>
					</td>
					<td class="min-w-56">
						<div class="flex flex-wrap gap-1">
							{#each [...(record.dsa_articles ?? []), ...(record.keywords ?? [])].slice(0, 5) as tag}
								<span class="badge badge-ghost">{tag}</span>
							{/each}
						</div>
					</td>
					<td class="max-w-sm min-w-64 text-sm text-base-content/70">
						{#if getTimeline(record)}
							<div class="line-clamp-3">{getTimeline(record)}</div>
						{:else}
							-
						{/if}
					</td>
					<td class="max-w-sm min-w-64 text-sm">
						{#if sourceLinks(record).length}
							<div class="flex flex-col gap-1">
								{#each sourceLinks(record).slice(0, 3) as link}
									<a
										class="link truncate link-primary"
										href={link}
										target="_blank"
										rel="noreferrer"
									>
										{sourceLabel(link)}
									</a>
								{/each}
							</div>
						{:else if getSourceText(record)}
							<div class="line-clamp-3 text-base-content/70">{getSourceText(record)}</div>
						{:else}
							-
						{/if}
					</td>
					{#if canWrite}
						<td class="text-right">
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
