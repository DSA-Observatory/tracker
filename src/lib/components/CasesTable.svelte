<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { FilterOption } from '$lib/components/FilterMenu.svelte';
	import CaseCardsList from '$lib/components/cases/CaseCardsList.svelte';
	import CaseFilterPanel from '$lib/components/cases/CaseFilterPanel.svelte';
	import CaseResultsTable from '$lib/components/cases/CaseResultsTable.svelte';
	import CaseVisualizationControls from '$lib/components/cases/CaseVisualizationControls.svelte';
	import { statusOptions } from '$lib/components/cases/types';
	import type {
		ActiveFilterChip,
		FilterGroup,
		FilterLayout,
		SearchScope,
		ViewMode
	} from '$lib/components/cases/types';
	import { authStore, pb, type CaseRecord } from '$lib/database';

	const categoryOptions = ['Due Diligence', 'Intermediary Liability', 'P2B', 'Other'];
	const countryFlags: Record<string, string> = {
		Denmark: '🇩🇰',
		FR: '🇫🇷',
		France: '🇫🇷',
		Germany: '🇩🇪',
		Netherlands: '🇳🇱',
		Poland: '🇵🇱',
		Spain: '🇪🇸'
	};
	const viewModeStorageKey = 'cases:viewMode';
	const filterLayoutStorageKey = 'cases:filterLayout';

	const searchScopes: { value: SearchScope; label: string }[] = [
		{ value: 'all', label: 'All fields' },
		{ value: 'case', label: 'Case details' },
		{ value: 'parties', label: 'Parties' },
		{ value: 'legal', label: 'Legal tags' },
		{ value: 'sources', label: 'Sources' },
		{ value: 'timeline', label: 'Timeline' },
		{ value: 'primary', label: 'Primary sources' },
		{ value: 'secondary', label: 'Secondary sources' }
	];

	let cases = $state<CaseRecord[]>([]);
	let search = $state(page.url.searchParams.get('q') ?? '');
	let searchScope = $state<SearchScope>('all');
	let statuses = $state<string[]>([]);
	let countries = $state<string[]>([]);
	let categories = $state<string[]>([]);
	let themes = $state<string[]>([]);
	let articles = $state<string[]>([]);
	let courts = $state<string[]>([]);
	let parties = $state<string[]>([]);
	let years = $state<string[]>([]);
	let loading = $state(true);
	let error = $state('');
	let viewMode = $state<ViewMode>('cards');
	let filterLayout = $state<FilterLayout>('top');
	let tableScrollTop = $state(0);
	let tableViewportHeight = $state(640);
	let tableScroller = $state<HTMLElement>();
	let preferencesLoaded = $state(false);

	const rowOverscan = 8;

	const canWrite = $derived(authStore.isAuthenticated);
	const statusFilterOptions = $derived(buildOptions('statuses', statusOptions));
	const availableCountries = $derived(uniqueSorted(cases.map((record) => record.jurisdiction)));
	const countryFilterOptions = $derived(buildOptions('countries', availableCountries));
	const availableCategories = $derived(
		categoryOptions.filter((category) => cases.some((record) => hasKeyword(record, category)))
	);
	const categoryFilterOptions = $derived(buildOptions('categories', availableCategories));
	const availableThemes = $derived(
		uniqueSorted(
			cases.flatMap((record) =>
				(record.keywords ?? []).filter((keyword) => !categoryOptions.includes(keyword))
			)
		)
	);
	const themeFilterOptions = $derived(buildOptions('themes', availableThemes));
	const articleFilterOptions = $derived(
		buildOptions('articles', uniqueSorted(cases.flatMap((record) => record.dsa_articles ?? [])))
	);
	const courtFilterOptions = $derived(
		buildOptions('courts', uniqueSorted(cases.map((record) => record.court)))
	);
	const partyFilterOptions = $derived(
		buildOptions(
			'parties',
			uniqueSorted(
				cases.flatMap((record) => [...(record.plaintiffs ?? []), ...(record.defendants ?? [])])
			)
		)
	);
	const yearFilterOptions = $derived(
		buildOptions('years', uniqueSorted(cases.map((record) => getDecisionYear(record))))
	);
	const filteredCases = $derived(cases.filter((record) => matchesFilters(record)));
	const activeChips = $derived(buildActiveChips());
	const rowHeight = $derived(viewMode === 'cards' ? 146 : 176);
	const virtualStart = $derived(Math.max(0, Math.floor(tableScrollTop / rowHeight) - rowOverscan));
	const virtualEnd = $derived(
		Math.min(
			filteredCases.length,
			Math.ceil((tableScrollTop + tableViewportHeight) / rowHeight) + rowOverscan
		)
	);
	const virtualRows = $derived(filteredCases.slice(virtualStart, virtualEnd));
	const topSpacerHeight = $derived(virtualStart * rowHeight);
	const bottomSpacerHeight = $derived((filteredCases.length - virtualEnd) * rowHeight);
	const filterPanelProps = $derived({
		filteredCount: filteredCases.length,
		totalCount: cases.length,
		viewMode,
		search,
		activeChips,
		statusFilterOptions,
		countryFilterOptions,
		categoryFilterOptions,
		themeFilterOptions,
		articleFilterOptions,
		courtFilterOptions,
		partyFilterOptions,
		yearFilterOptions,
		statuses,
		countries,
		categories,
		themes,
		articles,
		courts,
		parties,
		years,
		onToggle: toggleFilter,
		onClear: clearFilters
	});
	const resultProps = $derived({
		loading,
		filteredCount: filteredCases.length,
		virtualRows,
		topSpacerHeight,
		bottomSpacerHeight,
		rowHeight,
		canWrite,
		onEdit: editCase,
		onDelete: deleteCase
	});

	$effect(() => {
		if (!preferencesLoaded) return;
		if (browser) localStorage.setItem(viewModeStorageKey, viewMode);
	});

	$effect(() => {
		if (!preferencesLoaded) return;
		if (browser) localStorage.setItem(filterLayoutStorageKey, filterLayout);
	});

	$effect(() => {
		search;
		searchScope;
		statuses;
		countries;
		categories;
		themes;
		articles;
		courts;
		parties;
		years;
		viewMode;
		filterLayout;
		resetTableScroll();
	});

	function loadPreferences() {
		if (!browser) return;

		const stored = localStorage.getItem(viewModeStorageKey);
		viewMode = stored === 'table' ? stored : 'cards';

		const storedLayout = localStorage.getItem(filterLayoutStorageKey);
		filterLayout = storedLayout === 'left' ? storedLayout : 'top';
		preferencesLoaded = true;
	}

	function uniqueSorted(values: (string | undefined)[]) {
		return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])].sort(
			(a, b) => a.localeCompare(b)
		);
	}

	function hasKeyword(record: CaseRecord, value: string) {
		return (record.keywords ?? []).includes(value);
	}

	function countryLabel(country: string) {
		return [countryFlags[country], country].filter(Boolean).join(' ');
	}

	function countryFlag(country: string) {
		return countryFlags[country] ?? '';
	}

	function matchesAny(selected: string[], values: (string | undefined)[]) {
		return selected.length === 0 || values.some((value) => value && selected.includes(value));
	}

	function stripHtml(value?: string) {
		return (value ?? '').replace(/<[^>]+>/g, ' ');
	}

	function getSummarySection(record: CaseRecord, heading: string) {
		const pattern = new RegExp(`<h3>\\s*${heading}\\s*<\\/h3>\\s*<p>(.*?)<\\/p>`, 'is');
		const match = record.summary?.match(pattern);
		return stripHtml(match?.[1]);
	}

	function getTimeline(record: CaseRecord) {
		return getSummarySection(record, 'Case timeline');
	}

	function getPrimarySources(record: CaseRecord) {
		return getSummarySection(record, 'Primary sources');
	}

	function getSecondarySources(record: CaseRecord) {
		return getSummarySection(record, 'Secondary sources');
	}

	function getSourceText(record: CaseRecord) {
		return [getPrimarySources(record), getSecondarySources(record), record.commentary]
			.filter(Boolean)
			.join(' ');
	}

	function sourceLinks(record: CaseRecord) {
		return uniqueSorted([
			...(record.document_links ?? []),
			...Array.from(stripHtml(record.summary).matchAll(/https?:\/\/[^\s)]+/g), (match) => match[0])
		]);
	}

	function sourceLabel(url: string) {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	}

	function sourceText(record: CaseRecord) {
		const links = sourceLinks(record);
		if (links.length === 0) return getSourceText(record) || '-';
		return links.length === 1 ? '1 source' : `${links.length} sources`;
	}

	function getDecisionYear(record: CaseRecord) {
		return record.decision_date
			? new Date(record.decision_date).getFullYear().toString()
			: undefined;
	}

	function formatDate(value?: string) {
		return value ? new Date(value).toLocaleDateString() : '-';
	}

	function caseTags(record: CaseRecord) {
		return [...(record.dsa_articles ?? []), ...(record.keywords ?? [])];
	}

	function getPartyValues(record: CaseRecord) {
		return [...(record.plaintiffs ?? []), ...(record.defendants ?? [])];
	}

	function recordValuesForSearch(record: CaseRecord) {
		const caseValues = [
			record.case_id,
			record.title,
			record.ecli,
			record.court,
			record.jurisdiction
		];
		const partyValues = getPartyValues(record);
		const legalValues = [...(record.keywords ?? []), ...(record.dsa_articles ?? [])];
		const sourceValues = [
			stripHtml(record.summary),
			record.commentary,
			...(record.document_links ?? [])
		];

		if (searchScope === 'case') return caseValues;
		if (searchScope === 'parties') return partyValues;
		if (searchScope === 'legal') return legalValues;
		if (searchScope === 'timeline') return [getTimeline(record)];
		if (searchScope === 'primary') return [getPrimarySources(record)];
		if (searchScope === 'secondary') return [getSecondarySources(record), record.commentary];
		if (searchScope === 'sources') return sourceValues;
		return [...caseValues, ...partyValues, ...legalValues, ...sourceValues];
	}

	function matchesSearch(record: CaseRecord) {
		const query = search.trim().toLowerCase();
		if (!query) return true;

		return recordValuesForSearch(record)
			.filter(Boolean)
			.some((value) => String(value).toLowerCase().includes(query));
	}

	function matchesFilters(record: CaseRecord, ignoredGroup?: FilterGroup) {
		return (
			matchesSearch(record) &&
			(ignoredGroup === 'statuses' || matchesAny(statuses, [record.status])) &&
			(ignoredGroup === 'countries' || matchesAny(countries, [record.jurisdiction])) &&
			(ignoredGroup === 'categories' || matchesAny(categories, record.keywords ?? [])) &&
			(ignoredGroup === 'themes' || matchesAny(themes, record.keywords ?? [])) &&
			(ignoredGroup === 'articles' || matchesAny(articles, record.dsa_articles ?? [])) &&
			(ignoredGroup === 'courts' || matchesAny(courts, [record.court])) &&
			(ignoredGroup === 'parties' || matchesAny(parties, getPartyValues(record))) &&
			(ignoredGroup === 'years' || matchesAny(years, [getDecisionYear(record)]))
		);
	}

	function optionCount(group: FilterGroup, option: string) {
		return cases.filter((record) => {
			if (!matchesFilters(record, group)) return false;
			if (group === 'statuses') return record.status === option;
			if (group === 'countries') return record.jurisdiction === option;
			if (group === 'categories' || group === 'themes') return hasKeyword(record, option);
			if (group === 'articles') return (record.dsa_articles ?? []).includes(option);
			if (group === 'courts') return record.court === option;
			if (group === 'parties') return getPartyValues(record).includes(option);
			return getDecisionYear(record) === option;
		}).length;
	}

	function optionLabel(group: FilterGroup, option: string) {
		return group === 'countries' ? countryLabel(option) : option;
	}

	function buildOptions(group: FilterGroup, options: string[]): FilterOption[] {
		return options.map((option) => ({
			value: option,
			label: optionLabel(group, option),
			count: optionCount(group, option)
		}));
	}

	function selectedFor(group: FilterGroup) {
		if (group === 'statuses') return statuses;
		if (group === 'countries') return countries;
		if (group === 'categories') return categories;
		if (group === 'themes') return themes;
		if (group === 'articles') return articles;
		if (group === 'courts') return courts;
		if (group === 'parties') return parties;
		return years;
	}

	function toggleFilter(group: FilterGroup, value: string) {
		const selected = selectedFor(group);
		const next = selected.includes(value)
			? selected.filter((item) => item !== value)
			: [...selected, value];

		if (group === 'statuses') statuses = next;
		if (group === 'countries') countries = next;
		if (group === 'categories') categories = next;
		if (group === 'themes') themes = next;
		if (group === 'articles') articles = next;
		if (group === 'courts') courts = next;
		if (group === 'parties') parties = next;
		if (group === 'years') years = next;
	}

	function buildActiveChips() {
		const chips: ActiveFilterChip[] = [];
		const groups: FilterGroup[] = [
			'statuses',
			'countries',
			'categories',
			'themes',
			'articles',
			'courts',
			'parties',
			'years'
		];

		for (const group of groups) {
			for (const value of selectedFor(group)) {
				chips.push({ group, value, label: optionLabel(group, value) });
			}
		}

		return chips;
	}

	function clearFilters() {
		search = '';
		statuses = [];
		countries = [];
		categories = [];
		themes = [];
		articles = [];
		courts = [];
		parties = [];
		years = [];
		resetTableScroll();
	}

	function resetTableScroll() {
		tableScrollTop = 0;
		if (tableScroller) tableScroller.scrollTop = 0;
	}

	function updateTableViewport() {
		if (!tableScroller) return;
		tableScrollTop = tableScroller.scrollTop;
		tableViewportHeight = tableScroller.clientHeight;
	}

	async function loadCases() {
		loading = true;
		error = '';

		try {
			cases = await pb.collection('cases').getFullList<CaseRecord>({
				sort: '-decision_date,-created'
			});
		} catch (err) {
			console.error('Error loading cases:', err);
			error = 'Could not load cases. Check PocketBase availability and collection rules.';
		} finally {
			loading = false;
		}
	}

	function editCase(record: CaseRecord) {
		goto(`/cases/${record.id}/edit`);
	}

	async function deleteCase(record: CaseRecord) {
		if (!confirm(`Delete ${record.case_id}: ${record.title}?`)) return;

		try {
			await pb.collection('cases').delete(record.id);
			cases = cases.filter((item) => item.id !== record.id);
		} catch (err) {
			console.error('Error deleting case:', err);
			error = 'Could not delete the case. Check your permissions.';
		}
	}

	onMount(() => {
		loadPreferences();
		loadCases();
	});
</script>

<section
	id="cases"
	class="mx-auto flex h-full min-h-0 w-full max-w-[1680px] flex-col overflow-hidden px-4 pt-3 pb-4 sm:px-6 lg:px-8"
>
	<div class="z-30 mb-4 flex-none space-y-3">
		<div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
			<div class="min-w-0">
				<div class="flex items-center gap-2 text-xs font-medium text-slate-500">
					<span>Case database</span>
					<span aria-hidden="true">/</span>
					<span>{filteredCases.length} of {cases.length}</span>
				</div>
				<h1 class="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Cases</h1>
				<p class="mt-1 text-sm text-slate-500">
					Search and filter DSA private enforcement records.
				</p>
			</div>

			<div class="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
				<CaseVisualizationControls
					{viewMode}
					{filterLayout}
					onViewModeChange={(mode) => (viewMode = mode)}
					onFilterLayoutChange={(layout) => (filterLayout = layout)}
				/>
				{#if canWrite}
					<button
						class="inline-flex h-9 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-medium whitespace-nowrap text-white shadow-sm transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 focus-visible:outline-none"
						type="button"
						onclick={() => goto('/cases/new')}
					>
						Create case
					</button>
				{/if}
			</div>
		</div>

		<div
			class="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm shadow-slate-200/60 backdrop-blur"
		>
			<div class="grid gap-2 lg:grid-cols-[minmax(20rem,1fr)_13rem] lg:items-center">
				<label
					class="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-xs transition focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-950/10"
				>
					<span class="text-slate-400" aria-hidden="true">Search</span>
					<input
						class="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none"
						type="search"
						bind:value={search}
						placeholder="Search cases, parties, articles, sources"
					/>
				</label>
				<select
					class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-xs transition outline-none hover:bg-slate-50 focus:ring-2 focus:ring-slate-950/10"
					bind:value={searchScope}
					aria-label="Search scope"
				>
					{#each searchScopes as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			{#if filterLayout === 'top'}
				<CaseFilterPanel sidebar={false} {...filterPanelProps} />
			{:else}
				<div class="xl:hidden">
					<CaseFilterPanel sidebar={false} {...filterPanelProps} />
				</div>
			{/if}
		</div>
	</div>

	{#if error}
		<div
			class="mb-4 flex-none rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
		>
			{error}
		</div>
	{/if}

	<div
		class={filterLayout === 'left'
			? 'grid min-h-0 min-w-0 flex-1 gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]'
			: 'min-h-0 min-w-0 flex-1'}
	>
		{#if filterLayout === 'left'}
			<aside class="hidden min-h-0 xl:block">
				<CaseFilterPanel sidebar={true} {...filterPanelProps} />
			</aside>
		{/if}
		<div class="h-full min-h-0 min-w-0 overflow-hidden">
			{#if viewMode !== 'table'}
				<div
					bind:this={tableScroller}
					class="h-full min-h-0 max-w-full overflow-auto rounded-xl border border-slate-200 bg-white/70 p-3 shadow-sm shadow-slate-200/70"
					onscroll={updateTableViewport}
				>
					<CaseCardsList
						{...resultProps}
						{getPartyValues}
						{countryLabel}
						{caseTags}
						{formatDate}
						{sourceLinks}
						{sourceText}
					/>
				</div>
			{:else}
				<div
					bind:this={tableScroller}
					class="h-full min-h-0 max-w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70"
					onscroll={updateTableViewport}
				>
					<CaseResultsTable
						{...resultProps}
						{countryFlag}
						{getTimeline}
						{sourceLinks}
						{sourceLabel}
						{getSourceText}
					/>
				</div>
			{/if}
		</div>
	</div>
</section>
