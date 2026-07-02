<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import IconMap from '~icons/lucide/map';
	import type { FilterOption } from '$lib/components/FilterMenu.svelte';
	import CaseCardsList from '$lib/components/cases/CaseCardsList.svelte';
	import CaseFilterPanel from '$lib/components/cases/CaseFilterPanel.svelte';
	import CaseJurisdictionMap from '$lib/components/cases/CaseJurisdictionMap.svelte';
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
	type SearchIndexEntry = { text: string; words: string[] };

	let { showMap = false, mapStartsCollapsed = false, homeIntro = false } = $props<{
		showMap?: boolean;
		mapStartsCollapsed?: boolean;
		homeIntro?: boolean;
	}>();

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
	let countries = $state<string[]>(
		page.url.searchParams.get('jurisdiction')
			? [normalizeJurisdiction(page.url.searchParams.get('jurisdiction') as string) as string]
			: []
	);
	let categories = $state<string[]>([]);
	let themes = $state<string[]>([]);
	let articles = $state<string[]>([]);
	let courts = $state<string[]>([]);
	let parties = $state<string[]>([]);
	let years = $state<string[]>([]);
	let loading = $state(true);
	let error = $state('');
	let viewMode = $state<ViewMode>('cards');
	let filterLayout = $state<FilterLayout>('left');
	let tableScrollTop = $state(0);
	let tableViewportHeight = $state(640);
	let tableScroller = $state<HTMLElement>();
	let mapCollapsed = $state(mapStartsCollapsed);
	let preferencesLoaded = $state(false);
	let mobileFiltersOpen = $state(false);
	let isMobileViewport = $state(false);

	const rowOverscan = 8;

	const canWrite = $derived(authStore.isAuthenticated);
	const statusFilterOptions = $derived(buildOptions('statuses', statusOptions));
	const availableCountries = $derived(
		uniqueSorted(cases.map((record) => normalizeJurisdiction(record.jurisdiction)))
	);
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
	const normalizedSearch = $derived(normalizeSearchText(search.trim()));
	const searchParts = $derived(searchTokens(normalizedSearch));
	const searchIndex = $derived<Record<string, SearchIndexEntry>>(
		Object.fromEntries(cases.map((record) => [record.id, buildSearchIndexEntry(record)]))
	);
	const searchMatches = $derived<Record<string, boolean>>(
		Object.fromEntries(
			cases.map((record) => {
				const entry = searchIndex[record.id];
				return [
					record.id,
					!normalizedSearch || (entry ? matchesSearchIndexEntry(entry, normalizedSearch) : false)
				] as const;
			})
		)
	);
	const filteredCases = $derived(cases.filter((record) => matchesFilters(record)));
	const activeChips = $derived(buildActiveChips());
	const activeFilterCount = $derived(
		activeChips.length + (search.trim() || searchScope !== 'all' ? 1 : 0)
	);
	const jurisdictionCount = $derived(availableCountries.length);
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
	const visibleRows = $derived(isMobileViewport ? filteredCases : virtualRows);
	const visibleTopSpacerHeight = $derived(isMobileViewport ? 0 : topSpacerHeight);
	const visibleBottomSpacerHeight = $derived(isMobileViewport ? 0 : bottomSpacerHeight);
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
		virtualRows: visibleRows,
		topSpacerHeight: visibleTopSpacerHeight,
		bottomSpacerHeight: visibleBottomSpacerHeight,
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
		filterLayout = storedLayout === 'top' ? storedLayout : 'left';
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

	function normalizeJurisdiction(jurisdiction?: string) {
		return jurisdiction?.trim() === 'FR' ? 'France' : jurisdiction?.trim();
	}

	function matchesAny(selected: string[], values: (string | undefined)[]) {
		return selected.length === 0 || values.some((value) => value && selected.includes(value));
	}

	function matchesJurisdiction(record: CaseRecord, country: string) {
		return normalizeJurisdiction(record.jurisdiction) === country;
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

	function normalizeSearchText(value: string) {
		return value
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
	}

	function searchTokens(value: string) {
		return normalizeSearchText(value).match(/[\p{L}\p{N}]+/gu) ?? [];
	}

	function isNearToken(query: string, token: string) {
		const maxDistance = query.length < 4 ? 0 : query.length < 7 ? 1 : 2;
		if (Math.abs(query.length - token.length) > maxDistance) return false;

		const previous = Array.from({ length: token.length + 1 }, (_, index) => index);
		for (let i = 1; i <= query.length; i += 1) {
			let best = i;
			const current = [i];

			for (let j = 1; j <= token.length; j += 1) {
				current[j] = Math.min(
					current[j - 1] + 1,
					previous[j] + 1,
					previous[j - 1] + (query[i - 1] === token[j - 1] ? 0 : 1)
				);
				best = Math.min(best, current[j]);
			}

			if (best > maxDistance) return false;
			previous.splice(0, previous.length, ...current);
		}

		return previous[token.length] <= maxDistance;
	}

	function buildSearchIndexEntry(record: CaseRecord): SearchIndexEntry {
		const text = normalizeSearchText(recordValuesForSearch(record).filter(Boolean).join(' '));
		return { text, words: searchTokens(text) };
	}

	function matchesSearchIndexEntry(entry: SearchIndexEntry, query: string) {
		if (entry.text.includes(query)) return true;
		return (
			searchParts.length > 0 &&
			searchParts.every((part) =>
				entry.words.some((word) => word.includes(part) || isNearToken(part, word))
			)
		);
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
			record.outcome,
			record.court,
			record.jurisdiction
		];
		const partyValues = getPartyValues(record);
		const legalValues = [
			...(record.dsa_articles ?? []),
			...(record.legal_areas ?? []),
			...(record.legal_basis ?? []),
			...getCategories(record),
			...getThemes(record),
			...(record.keywords ?? [])
		];
		const sourceValues = [
			stripHtml(record.summary),
			getTimeline(record),
			record.source_limitations,
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
		return searchMatches[record.id] ?? false;
	}

	function matchesFilters(record: CaseRecord, ignoredGroup?: FilterGroup) {
		return (
			matchesSearch(record) &&
			(ignoredGroup === 'statuses' || matchesAny(statuses, [record.status])) &&
			(ignoredGroup === 'countries' ||
				matchesAny(countries, [normalizeJurisdiction(record.jurisdiction)])) &&
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
			if (group === 'countries') return matchesJurisdiction(record, option);
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

	function closeMobileFilters() {
		mobileFiltersOpen = false;
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
		goto(resolve(`/cases/${record.id}/edit`));
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

	function downloadFilteredCases(format: 'csv' | 'json') {
		const rows = filteredCases.map((record) => ({
			case_id: record.case_id,
			title: record.title,
			status: record.status,
			outcome: record.outcome ?? '',
			jurisdiction: record.jurisdiction ?? '',
			court: record.court ?? '',
			decision_date: record.decision_date ?? '',
			ecli: record.ecli ?? '',
			plaintiffs: (record.plaintiffs ?? []).join('; '),
			defendants: (record.defendants ?? []).join('; '),
			dsa_articles: (record.dsa_articles ?? []).join('; '),
			legal_areas: (record.legal_areas ?? []).join('; '),
			legal_basis: (record.legal_basis ?? []).join('; '),
			url: `${window.location.origin}${resolve(`/cases/${record.id}`)}`
		}));

		const body = format === 'json' ? JSON.stringify(rows, null, 2) : toCsv(rows);
		const type = format === 'json' ? 'application/json' : 'text/csv';
		const blob = new Blob([body], { type: `${type};charset=utf-8` });
		downloadBlob(`dsa-cases-${new Date().toISOString().slice(0, 10)}.${format}`, blob);
	}

	function downloadBlob(filename: string, blob: Blob) {
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		link.click();
		URL.revokeObjectURL(url);
	}

	function toCsv(rows: Record<string, string>[]) {
		if (!rows.length) return '';
		const headers = Object.keys(rows[0]);
		return [
			headers.join(','),
			...rows.map((row) => headers.map((header) => csvCell(row[header])).join(','))
		].join('\n');
	}

	function csvCell(value: string) {
		return `"${value.replace(/"/g, '""')}"`;
	}

	onMount(() => {
		const mediaQuery = window.matchMedia('(max-width: 767px)');
		const updateMobileViewport = () => {
			isMobileViewport = mediaQuery.matches;
		};

		updateMobileViewport();
		mediaQuery.addEventListener('change', updateMobileViewport);
		loadPreferences();
		loadCases();

		return () => {
			mediaQuery.removeEventListener('change', updateMobileViewport);
		};
	});
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') closeMobileFilters();
	}}
/>

<section
	id="cases"
	class="mx-auto flex w-full max-w-[1680px] flex-col px-4 pt-1 pb-4 sm:px-6 md:h-full md:min-h-0 md:overflow-hidden md:pt-3 lg:px-8"
>
	<div class="z-30 mb-3 flex-none space-y-2 md:mb-4 md:space-y-3">
		<div>
			{#if homeIntro}
				<div
					class="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm shadow-slate-200/60"
				>
					<div class="relative flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-5">
						<div class="min-w-0">
							<p class="text-xs font-black tracking-[0.28em] text-amber-500 uppercase">
								DSA Case Law Tracker
							</p>
							<h1 class="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
								Private enforcement cases, ready to explore.
							</h1>
							<p class="mt-1 max-w-2xl text-sm text-slate-600">
								Search, filter, map, and compare DSA litigation across jurisdictions.
							</p>
						</div>
						<div class="flex shrink-0 flex-wrap gap-2 text-sm">
							<div class="rounded-xl border border-slate-200 bg-white/75 px-3 py-2 shadow-xs">
								<span class="font-black text-slate-950">{cases.length}</span>
								<span class="text-slate-500"> cases</span>
							</div>
							{#if showMap}
								<button
									class={mapCollapsed
										? 'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/75 px-3 py-2 text-left shadow-xs transition hover:border-slate-300 hover:bg-white focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:outline-none'
										: 'inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-left shadow-xs transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:outline-none'}
									type="button"
									aria-pressed={!mapCollapsed}
									title={mapCollapsed ? 'Show map' : 'Hide map'}
									onclick={() => (mapCollapsed = !mapCollapsed)}
								>
									<IconMap class="size-4 text-slate-500" />
									<span><span class="font-black text-slate-950">{jurisdictionCount}</span>
										<span class="text-slate-500"> countries</span></span
									>
								</button>
							{:else}
								<div class="rounded-xl border border-slate-200 bg-white/75 px-3 py-2 shadow-xs">
									<span class="font-black text-slate-950">{jurisdictionCount}</span>
									<span class="text-slate-500"> countries</span>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{:else}
				<div class="sr-only md:not-sr-only md:mb-3 md:min-w-0">
					<h1 class="text-xl font-semibold tracking-tight text-slate-950 md:text-2xl">Cases</h1>
					<p class="mt-1 text-sm text-slate-500">
						Search and filter DSA private enforcement records.
					</p>
				</div>
			{/if}
			<div
				class="rounded-lg border border-slate-200 bg-white/90 p-2 shadow-sm shadow-slate-200/60 backdrop-blur md:hidden"
			>
				<Search
					bind:value={search}
					bind:searchScope
					scopes={searchScopes}
					placeholder="Search cases, parties, articles, sources"
					navigateOnSubmit={false}
					variant="hero"
					bare={true}
				/>

				<div class="mt-2 flex items-center justify-between gap-2">
					<div
						class="inline-flex items-center rounded-md border border-slate-200 bg-white/80 p-0.5 shadow-xs"
					>
						<button
							class={viewMode === 'cards'
								? 'h-7 rounded-sm bg-slate-100 px-2.5 text-xs font-semibold text-slate-950 transition'
								: 'h-7 rounded-sm px-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800'}
							type="button"
							onclick={() => (viewMode = 'cards')}>Cards</button
						>
						<button
							class={viewMode === 'table'
								? 'h-7 rounded-sm bg-slate-100 px-2.5 text-xs font-semibold text-slate-950 transition'
								: 'h-7 rounded-sm px-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800'}
							type="button"
							onclick={() => (viewMode = 'table')}>Table</button
						>
					</div>

					<div class="flex items-center gap-1.5">
						<details class="relative">
							<summary
								class="inline-flex h-8 shrink-0 cursor-pointer list-none items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-xs transition hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:outline-none"
							>
								Export
								<span class="text-[0.6rem] text-slate-500" aria-hidden="true">▼</span>
							</summary>
							<div
								class="absolute right-0 z-50 mt-1 min-w-32 rounded-md border border-slate-200 bg-white p-1 shadow-lg"
							>
								<button
									class="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
									type="button"
									onclick={() => downloadFilteredCases('csv')}>CSV</button
								>
								<button
									class="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
									type="button"
									onclick={() => downloadFilteredCases('json')}>JSON</button
								>
							</div>
						</details>
						{#if canWrite}
							<button
								class="inline-flex h-8 shrink-0 items-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-xs transition hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:outline-none"
								type="button"
								onclick={() => goto(resolve('/cases/new'))}>Create</button
							>
						{/if}
						<button
							class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-xs transition hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:outline-none"
							type="button"
							onclick={() => (mobileFiltersOpen = true)}
							aria-haspopup="dialog"
							aria-expanded={mobileFiltersOpen}
						>
							Filters
							{#if activeFilterCount > 0}<span
									class="rounded-full bg-slate-950 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white"
									>{activeFilterCount}</span
								>{/if}
						</button>
					</div>
				</div>
			</div>

			<div class="hidden md:block">
				<Search
					bind:value={search}
					bind:searchScope
					scopes={searchScopes}
					placeholder="Search cases, parties, articles, sources"
					navigateOnSubmit={false}
					variant="hero"
				>
					{#snippet trailing()}
						<CaseVisualizationControls
							{viewMode}
							{filterLayout}
							onViewModeChange={(mode) => (viewMode = mode)}
							onFilterLayoutChange={(layout) => (filterLayout = layout)}
						/>
						<details class="relative">
							<summary
								class="inline-flex h-8 cursor-pointer list-none items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold whitespace-nowrap text-slate-800 shadow-xs transition hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:outline-none"
							>
								Export
								<span class="text-[0.6rem] text-slate-500" aria-hidden="true">▼</span>
							</summary>
							<div
								class="absolute right-0 z-50 mt-1 min-w-36 rounded-md border border-slate-200 bg-white p-1 shadow-lg"
							>
								<button
									class="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
									type="button"
									onclick={() => downloadFilteredCases('csv')}>CSV</button
								>
								<button
									class="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
									type="button"
									onclick={() => downloadFilteredCases('json')}>JSON</button
								>
							</div>
						</details>
						{#if canWrite}<button
								class="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold whitespace-nowrap text-slate-800 shadow-xs transition hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:outline-none"
								type="button"
								onclick={() => goto(resolve('/cases/new'))}>Create case</button
							>{/if}
					{/snippet}
				</Search>
			</div>
			<div class="hidden items-center justify-between gap-3 md:flex xl:hidden">
				<p class="min-w-0 text-sm text-slate-500">
					Showing <span class="font-medium text-slate-900">{filteredCases.length}</span> of {cases.length}
					cases
				</p>
			</div>

			{#if filterLayout === 'top'}
				<div class="hidden md:block">
					<CaseFilterPanel sidebar={false} {...filterPanelProps} />
				</div>
			{:else}
				<div class="hidden md:block xl:hidden">
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

	{#if showMap && !mapCollapsed}
		<div class="mb-4 flex-none">
			<CaseJurisdictionMap
				cases={cases}
				collapsed={mapCollapsed}
				compact={true}
				showList={false}
				showToggle={false}
			/>
		</div>
	{/if}

	<div
		class={filterLayout === 'left'
			? 'grid min-w-0 gap-4 md:min-h-0 md:flex-1 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]'
			: 'min-w-0 md:min-h-0 md:flex-1'}
	>
		{#if filterLayout === 'left'}
			<aside class="hidden min-h-0 min-w-0 overflow-hidden xl:block">
				<CaseFilterPanel sidebar={true} {...filterPanelProps} />
			</aside>
		{/if}
		<div class="min-w-0 md:h-full md:min-h-0 md:overflow-hidden">
			{#if viewMode !== 'table'}
				<div
					bind:this={tableScroller}
					class="max-w-full overflow-visible rounded-sm border border-slate-200 bg-white/70 p-3 shadow-sm shadow-slate-200/70 md:h-full md:min-h-0 md:overflow-auto"
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
					class="max-w-full overflow-x-auto overflow-y-visible rounded-sm border border-slate-200 bg-white shadow-sm shadow-slate-200/70 md:h-full md:min-h-0 md:overflow-auto"
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

{#if mobileFiltersOpen}
	<div
		class="fixed inset-0 z-[10020] md:hidden"
		role="dialog"
		aria-modal="true"
		aria-label="Case filters"
	>
		<button
			class="absolute inset-0 bg-slate-950/45"
			type="button"
			onclick={closeMobileFilters}
			aria-label="Close filters"
		></button>
		<div
			class="absolute right-0 bottom-0 left-0 max-h-[82dvh] overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20"
		>
			<div class="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
				<div class="min-w-0">
					<p class="text-sm font-semibold text-slate-950">Filter cases</p>
					<p class="text-xs text-slate-500">Showing {filteredCases.length} of {cases.length}</p>
				</div>
				<button
					class="grid size-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xl leading-none text-slate-600 transition hover:bg-slate-200 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:outline-none"
					type="button"
					onclick={closeMobileFilters}
					aria-label="Close filters"
				>
					<span aria-hidden="true">×</span>
				</button>
			</div>
			<div class="max-h-[calc(82dvh-4rem)] overflow-y-auto px-4 pb-5">
				<CaseFilterPanel sidebar={true} {...filterPanelProps} />
			</div>
		</div>
	</div>
{/if}
