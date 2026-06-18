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
	import Search from '$lib/components/Search.svelte';
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
		categoryOptions.filter((category) =>
			cases.some((record) => getCategories(record).includes(category))
		)
	);
	const categoryFilterOptions = $derived(buildOptions('categories', availableCategories));
	const availableThemes = $derived(uniqueSorted(cases.flatMap((record) => getThemes(record))));
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
	const rowHeight = $derived(viewMode === 'cards' ? 252 : 176);
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

	function countryLabel(country: string) {
		return [countryFlags[country], country].filter(Boolean).join(' ');
	}

	function countryFlag(country: string) {
		return countryFlags[country] ?? '';
	}

	function matchesAny(selected: string[], values: (string | undefined)[]) {
		return selected.length === 0 || values.some((value) => value && selected.includes(value));
	}

	function decodeHtmlEntities(value?: string) {
		return (value ?? '')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'");
	}

	function cleanText(value?: string) {
		return decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();
	}

	function stripHtml(value?: string) {
		return cleanText((value ?? '').replace(/<[^>]+>/g, ' '));
	}

	function listOrFallback(values: string[] | undefined, fallback?: string) {
		const list = Array.isArray(values) ? values.map(cleanText).filter(Boolean) : [];
		if (list.length) return list;
		return cleanText(fallback) ? [cleanText(fallback)] : [];
	}

	function getCategories(record: CaseRecord) {
		const categories = listOrFallback(record.categories);
		if (categories.length) return categories;
		return (record.keywords ?? []).filter((keyword) => categoryOptions.includes(keyword));
	}

	function getThemes(record: CaseRecord) {
		const themes = listOrFallback(record.themes);
		if (themes.length) return themes;
		return (record.keywords ?? []).filter((keyword) => !categoryOptions.includes(keyword));
	}

	function getSummarySection(record: CaseRecord, heading: string) {
		const pattern = new RegExp(`<h3>\\s*${heading}\\s*<\\/h3>\\s*<p>(.*?)<\\/p>`, 'is');
		const match = record.summary?.match(pattern);
		return stripHtml(match?.[1]);
	}

	function getTimeline(record: CaseRecord) {
		return stripHtml(record.timeline) || getSummarySection(record, 'Case timeline');
	}

	function getPrimarySources(record: CaseRecord) {
		return getSummarySection(record, 'Primary sources');
	}

	function getSecondarySources(record: CaseRecord) {
		return getSummarySection(record, 'Secondary sources');
	}

	function getPrimarySourcesList(record: CaseRecord) {
		return listOrFallback(record.primary_sources, getPrimarySources(record));
	}

	function getSecondarySourcesList(record: CaseRecord) {
		return listOrFallback(record.secondary_sources, getSecondarySources(record));
	}

	function getSourceText(record: CaseRecord) {
		return [...getPrimarySourcesList(record), ...getSecondarySourcesList(record), record.commentary]
			.filter(Boolean)
			.join(' ');
	}

	function extractUrls(value?: string) {
		return Array.from(decodeHtmlEntities(value).matchAll(/https?:\/\/[^\s)]+/g), (match) =>
			match[0].replace(/[.,;]+$/, '')
		);
	}

	function sourceLinks(record: CaseRecord) {
		const links = [
			...(record.document_links ?? []),
			...extractUrls(record.summary),
			...extractUrls(record.timeline),
			...getPrimarySourcesList(record).flatMap(extractUrls),
			...getSecondarySourcesList(record).flatMap(extractUrls)
		];
		const deduped = new Map<string, string>();

		for (const link of links
			.map(decodeHtmlEntities)
			.map((link) => link.trim())
			.filter(Boolean)) {
			const key = link.toLowerCase();
			if (!deduped.has(key)) deduped.set(key, link);
		}

		return [...deduped.values()].sort((a, b) => sourceLabel(a).localeCompare(sourceLabel(b)));
	}

	function sourceLabel(url: string) {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	}

	function getDecisionYear(record: CaseRecord) {
		return record.decision_date
			? new Date(record.decision_date).getFullYear().toString()
			: undefined;
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
		const legalValues = [
			...(record.dsa_articles ?? []),
			...getCategories(record),
			...getThemes(record),
			...(record.keywords ?? [])
		];
		const sourceValues = [
			stripHtml(record.summary),
			getTimeline(record),
			...getPrimarySourcesList(record),
			...getSecondarySourcesList(record),
			record.commentary,
			...(record.document_links ?? [])
		];

		if (searchScope === 'case') return caseValues;
		if (searchScope === 'parties') return partyValues;
		if (searchScope === 'legal') return legalValues;
		if (searchScope === 'timeline') return [getTimeline(record)];
		if (searchScope === 'primary') return getPrimarySourcesList(record);
		if (searchScope === 'secondary') return [...getSecondarySourcesList(record), record.commentary];
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
			(ignoredGroup === 'categories' || matchesAny(categories, getCategories(record))) &&
			(ignoredGroup === 'themes' || matchesAny(themes, getThemes(record))) &&
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
			if (group === 'categories') return getCategories(record).includes(option);
			if (group === 'themes') return getThemes(record).includes(option);
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
		searchScope = 'all';
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
						class="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold whitespace-nowrap text-slate-800 shadow-xs transition hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:outline-none"
						type="button"
						onclick={() => goto('/cases/new')}
					>
						Create case
					</button>
				{/if}
			</div>
		</div>

		<div>
			<Search
				bind:value={search}
				bind:searchScope
				scopes={searchScopes}
				placeholder="Search cases, parties, articles, sources"
				navigateOnSubmit={false}
				variant="hero"
			/>

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
			? 'grid min-h-0 min-w-0 flex-1 gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]'
			: 'min-h-0 min-w-0 flex-1'}
	>
		{#if filterLayout === 'left'}
			<aside class="hidden min-h-0 min-w-0 overflow-hidden xl:block">
				<CaseFilterPanel sidebar={true} {...filterPanelProps} />
			</aside>
		{/if}
		<div class="h-full min-h-0 min-w-0 overflow-hidden">
			{#if viewMode !== 'table'}
				<div
					bind:this={tableScroller}
					class="h-full min-h-0 max-w-full overflow-auto rounded-sm border border-slate-200 bg-white/70 p-3 shadow-sm shadow-slate-200/70"
					onscroll={updateTableViewport}
				>
					<CaseCardsList
						{...resultProps}
						{getPartyValues}
						{countryLabel}
						{getCategories}
						{getThemes}
						{getTimeline}
						{getPrimarySourcesList}
						{getSecondarySourcesList}
						{sourceLinks}
						{sourceLabel}
					/>
				</div>
			{:else}
				<div
					bind:this={tableScroller}
					class="h-full min-h-0 max-w-full overflow-auto rounded-sm border border-slate-200 bg-white shadow-sm shadow-slate-200/70"
					onscroll={updateTableViewport}
				>
					<CaseResultsTable
						{...resultProps}
						{countryFlag}
						{getCategories}
						{getThemes}
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
