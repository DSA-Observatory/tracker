<script lang="ts">
	import { resolve } from '$app/paths';
	import CountryFlag from '$lib/components/CountryFlag.svelte';
	import type { CaseRecord } from '$lib/database';
	import IconChevronRight from '~icons/lucide/chevron-right';
	import IconExternalLink from '~icons/lucide/external-link';
	import IconMapPin from '~icons/lucide/map-pin';
	import IconPencil from '~icons/lucide/pencil';
	import IconStar from '~icons/lucide/star';

	let {
		loading,
		filteredCount,
		virtualRows,
		topSpacerHeight,
		bottomSpacerHeight,
		rowHeight,
		layout,
		canWrite,
		savedCaseIds,
		emptySaved,
		onToggleSaved,
		onEdit,
		countryLabel,
		getCategories,
		sourceLinks,
		sourceLabel
	}: {
		loading: boolean;
		filteredCount: number;
		virtualRows: CaseRecord[];
		topSpacerHeight: number;
		bottomSpacerHeight: number;
		rowHeight: number;
		layout: 'list' | 'grid';
		canWrite: boolean;
		savedCaseIds: string[];
		emptySaved: boolean;
		onToggleSaved: (record: CaseRecord) => void;
		onEdit: (record: CaseRecord) => void;
		countryLabel: (country: string) => string;
		getCategories: (record: CaseRecord) => string[];
		sourceLinks: (record: CaseRecord) => string[];
		sourceLabel: (url: string) => string;
	} = $props();

	function formatDecisionDate(value?: string) {
		if (!value) return '';
		const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
		const date = dateOnly
			? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])))
			: new Date(value);
		return Number.isNaN(date.getTime())
			? value
			: new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
	}

	function summaryText(value?: string) {
		return (value ?? '')
			.replace(/<[^>]+>/g, ' ')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function categoryLabelColor(category?: string) {
		if (category === 'Intermediary Liability') return 'bg-blue-50 text-blue-700';
		if (category === 'Due Diligence') return 'bg-emerald-50 text-emerald-700';
		return 'bg-slate-100 text-slate-600';
	}
</script>

{#if loading}
	<div class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
		Loading cases...
	</div>
{:else if filteredCount === 0}
	<div class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
		{emptySaved ? 'No saved cases yet. Saved cases stay in this browser.' : 'No cases found.'}
	</div>
{:else}
	{#if topSpacerHeight > 0}<div
			aria-hidden="true"
			style={`height: ${topSpacerHeight}px;`}
		></div>{/if}
	<div class={layout === 'grid' ? 'grid grid-cols-1 gap-3 xl:grid-cols-2' : 'space-y-3'}>
		{#each virtualRows as record (record.id)}
			{@const categories = getCategories(record)}
			{@const articles = record.dsa_articles ?? []}
			{@const links = sourceLinks(record)}
			{@const saved = savedCaseIds.includes(record.id)}
			{@const summary = summaryText(record.summary)}
			<article
				class={`group relative grid min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40 transition hover:border-slate-300 hover:shadow-md ${layout === 'grid' ? 'min-h-[14rem] p-5' : 'p-4 sm:p-5'}`}
				style={layout === 'list' ? `min-height: ${Math.max(150, rowHeight - 72)}px;` : undefined}
			>
				<a
					class="absolute inset-0 z-10 rounded-xl"
					href={resolve(`/cases/${record.id}`)}
					aria-label={`View ${record.title}`}
					tabindex="-1"
				></a>
				<div
					class={`relative min-w-0 pl-2 pr-12 ${layout === 'list' ? 'grid gap-4' : 'flex h-full flex-col'}`}
				>
					<div class={layout === 'grid' ? 'flex min-w-0 flex-1 flex-col' : 'min-w-0'}>
						<div class="mb-2 flex flex-wrap items-center gap-2">
							<span class={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold ${categoryLabelColor(categories[0])}`}>
							{#if categories[0]}
								<span>{categories[0]}</span>
							{/if}
							</span>
						</div>
						<a
							class="relative z-10 line-clamp-2 text-lg leading-snug font-bold tracking-tight text-slate-950"
							href={resolve(`/cases/${record.id}`)}
						>
							{record.title}
						</a>
						<div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
							{#if record.jurisdiction}<span class="inline-flex items-center gap-1.5"
									><CountryFlag country={record.jurisdiction} />{countryLabel(
										record.jurisdiction
									)}</span
								>{/if}
							{#if record.jurisdiction && record.court}<span
									class="text-slate-300"
									aria-hidden="true">·</span
								>{/if}
							{#if record.court}<span class="inline-flex min-w-0 items-center gap-1.5 truncate"
									><IconMapPin class="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
									<span class="truncate">{record.court}</span></span
								>{/if}
							{#if links[0]}
								<a class="relative z-10 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 hover:underline focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:outline-none" href={links[0]} target="_blank" rel="noreferrer" title={sourceLabel(links[0])} aria-label={`Open source: ${sourceLabel(links[0])}`}>
									Source <IconExternalLink class="size-3" aria-hidden="true" />
								</a>
							{/if}
						</div>
						{#if summary}<p
								class="mt-3 line-clamp-2 max-w-3xl text-sm leading-relaxed text-slate-600"
							>
								{summary}
							</p>{/if}
						{#if articles.length}
							<div class={`flex flex-wrap gap-1.5 ${layout === 'grid' ? 'mt-auto pt-4' : 'mt-4'}`}>
								{#each articles.slice(0, 4) as article}
									<span
									class="rounded-full bg-slate-100 px-2 py-1 text-[0.7rem] font-semibold text-slate-600"
										>{article}</span
									>
								{/each}
								{#if articles.length > 4}<span
										class="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[0.7rem] font-semibold text-slate-500"
										>+{articles.length - 4}</span
									>{/if}
							</div>
						{/if}
					</div>
					{#if record.decision_date || record.decision_reference}
						<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-relaxed text-slate-500">
							{#if record.decision_date}<span class="shrink-0 font-medium">{formatDecisionDate(record.decision_date)}</span>{/if}
							{#if record.decision_date && record.decision_reference}<span aria-hidden="true">·</span>{/if}
							{#if record.decision_reference}<p class="min-w-0 break-words">{record.decision_reference}</p>{/if}
						</div>
					{/if}
					<div
						class="absolute inset-y-0 right-0 z-10 flex flex-col items-center justify-center gap-1"
					>
						<button
							class={saved
								? 'absolute top-0 right-0 grid size-8 place-items-center rounded-full bg-amber-50 text-amber-500 transition hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:outline-none'
								: 'absolute top-0 right-0 grid size-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-amber-500 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:outline-none'}
							type="button"
							aria-pressed={saved}
							aria-label={saved ? 'Remove saved case' : 'Save case'}
							title={saved ? 'Remove saved case' : 'Save case'}
							onclick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								onToggleSaved(record);
							}}><IconStar class="size-4" fill={saved ? 'currentColor' : 'none'} /></button
						>
						<a
							class="grid size-10 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:outline-none"
							href={resolve(`/cases/${record.id}`)}
							aria-label={`View ${record.title}`}><IconChevronRight class="size-4" /></a
						>
					</div>
					{#if canWrite}
						<div class="absolute right-0 bottom-0 z-10 flex items-center gap-1 rounded-md bg-white opacity-100 transition lg:pointer-events-none lg:opacity-0 lg:group-has-[:focus-visible]:pointer-events-auto lg:group-has-[:focus-visible]:opacity-100 lg:group-hover:pointer-events-auto lg:group-hover:opacity-100">
							<button class="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:outline-none" type="button" aria-label={`Edit ${record.title}`} title="Edit case" onclick={() => onEdit(record)}><IconPencil class="size-3.5" />Edit case</button>
						</div>
					{/if}
				</div>
			</article>
		{/each}
	</div>
	{#if bottomSpacerHeight > 0}<div
			aria-hidden="true"
			style={`height: ${bottomSpacerHeight}px;`}
		></div>{/if}
{/if}
