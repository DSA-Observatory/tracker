<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { PersistedState } from 'runed';
	import { browser } from '$app/environment';
	import { afterNavigate, disableScrollHandling, goto } from '$app/navigation';
	import { asset, resolve } from '$app/paths';
	import { page } from '$app/state';
	import { claimEntryAnimation } from '$lib/entry-animation';
	import { casesCacheKey, readCasesCache, writeCasesCache } from '$lib/stores/cases-cache';
	import { caseExportRows, caseExportCsv, caseExportExcel } from '$lib/case-export';
	import type { FilterOption } from '$lib/components/FilterMenu.svelte';
	import CaseBrowseCards from '$lib/components/cases/CaseBrowseCards.svelte';
	import CaseCardsList from '$lib/components/cases/CaseCardsList.svelte';
	import CaseFilterPanel from '$lib/components/cases/CaseFilterPanel.svelte';
	import CaseJurisdictionMap from '$lib/components/cases/CaseJurisdictionMap.svelte';
	import CaseResultsTable from '$lib/components/cases/CaseResultsTable.svelte';
	import Search from '$lib/components/Search.svelte';
	import IconArrowUpDown from '~icons/lucide/arrow-up-down';
	import IconChevronDown from '~icons/lucide/chevron-down';
	import IconGrid from '~icons/lucide/list';
	import IconMap from '~icons/lucide/map';
	import IconTable from '~icons/lucide/table-2';
	import type {
		ActiveFilterChip,
		FilterGroup,
		FilterLayout,
		SearchScope,
		ViewMode
	} from '$lib/components/cases/types';
	import { authStore, pb, type CaseRecord } from '$lib/database';

	const categoryOptions = ['Due Diligence', 'Intermediary Liability', 'P2B', 'Other'];
	const viewModeStorageKey = 'cases:viewMode';
	const filterLayoutStorageKey = 'cases:filterLayout';
	const savedCasesStorageKey = `cases:saved:v1:${pb.baseURL}`;
	type SearchIndexEntry = { text: string; words: string[] };

	let {
		showMap = false,
		mapStartsCollapsed = false,
		homeIntro = false,
		cardVariant = 'default',
		publicationFilter,
		heading = 'Cases',
		description = 'Search and filter DSA private enforcement records.'
	} = $props<{
		showMap?: boolean;
		mapStartsCollapsed?: boolean;
		homeIntro?: boolean;
		cardVariant?: 'default' | 'landing';
		publicationFilter?: 'draft';
		heading?: string;
		description?: string;
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
	let countries = $state<string[]>(
		page.url.searchParams.get('jurisdiction')
			? [normalizeJurisdiction(page.url.searchParams.get('jurisdiction') as string) as string]
			: []
	);
	let categories = $state<string[]>([]);
	let articles = $state<string[]>([]);
	let courts = $state<string[]>([]);
	let years = $state<string[]>([]);
	let loading = $state(true);
	let error = $state('');
	let exporting = $state(false);
	let exportError = $state('');
	let viewMode = $state<ViewMode>('cards');
	let sortOrder = $state<'recent' | 'oldest' | 'title'>('recent');
	let filterLayout = $state<FilterLayout>('left');
	let activeTab = $state<'browse' | 'saved'>('browse');
	let savedCaseIds = $state<string[]>([]);
	let tableScrollTop = $state(0);
	let tableViewportHeight = $state(640);
	let tableScroller = $state<HTMLElement>();
	let mapCollapsed = $state(mapStartsCollapsed);
	let preferencesLoaded = $state(false);
	let mobileFiltersOpen = $state(false);
	let isMobileViewport = $state(false);
	let playEntry = $state(false);
	const saved = new PersistedState(
		`cases:workspace:v1:${publicationFilter ?? 'published'}:${heading}`,
		{
			search: '',
			searchScope: 'all' as SearchScope,
			countries: [] as string[],
			categories: [] as string[],
			articles: [] as string[],
			courts: [] as string[],
			years: [] as string[],
			viewMode: 'cards' as ViewMode,
			filterLayout: 'left' as FilterLayout,
			mapCollapsed: mapStartsCollapsed,
			tableScrollTop: 0,
			tableScrollLeft: 0,
			windowScrollY: 0,
			filterScrollTop: 0,
			visited: false
		},
		{ storage: 'session', syncTabs: false }
	);
	let tableScrollLeft = $state(0);
	let windowScrollY = $state(0);
	let filterScrollTop = $state(0);
	let previousFilters = '';
	let disposed = false;
	let requestVersion = 0;
	let refreshing = false;
	let refreshAgain = false;

	const rowOverscan = 8;

	const canWrite = $derived(authStore.isAdmin);
	const browseCases = $derived(
		activeTab === 'saved' ? cases.filter((record) => savedCaseIds.includes(record.id)) : cases
	);
	const availableCountries = $derived(
		uniqueSorted(browseCases.map((record) => normalizeJurisdiction(record.jurisdiction)))
	);
	const countryFilterOptions = $derived(buildOptions('countries', availableCountries));
	const availableCategories = $derived(
		categoryOptions.filter((category) =>
			browseCases.some((record) => getCategories(record).includes(category))
		)
	);
	const categoryFilterOptions = $derived(buildOptions('categories', availableCategories));
	const articleFilterOptions = $derived(
		buildOptions(
			'articles',
			uniqueSorted(browseCases.flatMap((record) => record.dsa_articles ?? []))
		)
	);
	const courtFilterOptions = $derived(
		buildOptions('courts', uniqueSorted(browseCases.map((record) => record.court)))
	);
	const yearFilterOptions = $derived(
		buildOptions('years', uniqueSorted(browseCases.map((record) => getDecisionYear(record))))
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
	const filteredCases = $derived(sortCases(browseCases.filter((record) => matchesFilters(record))));
	const activeChips = $derived(buildActiveChips());
	const activeFilterCount = $derived(
		activeChips.length + (search.trim() || searchScope !== 'all' ? 1 : 0)
	);
	const resetScrollTrigger = $derived([
		search,
		searchScope,
		countries,
		categories,
		articles,
		courts,
		years,
		viewMode,
		sortOrder,
		activeTab,
		filterLayout
	]);
	const caseStats = $derived({
		cases: cases.length,
		countries: uniqueSorted(cases.map((record) => normalizeJurisdiction(record.jurisdiction)))
			.length,
		courts: uniqueSorted(cases.map((record) => record.court)).length,
		categories: uniqueSorted(cases.flatMap((record) => getCategories(record))).length
	});
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
	const useCaseCardVirtualization = $derived(cardVariant !== 'landing' && !isMobileViewport);
	const visibleRows = $derived(useCaseCardVirtualization ? virtualRows : filteredCases);
	const visibleTopSpacerHeight = $derived(useCaseCardVirtualization ? topSpacerHeight : 0);
	const visibleBottomSpacerHeight = $derived(useCaseCardVirtualization ? bottomSpacerHeight : 0);
	const filterPanelProps = $derived({
		filteredCount: filteredCases.length,
		totalCount: cases.length,
		search,
		activeChips,
		countryFilterOptions,
		categoryFilterOptions,
		articleFilterOptions,
		courtFilterOptions,
		yearFilterOptions,
		countries,
		categories,
		articles,
		courts,
		years,
		activeTab,
		savedCount: savedCaseIds.filter((id) => cases.some((record) => record.id === id)).length,
		onTabChange: setActiveTab,
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
		if (!preferencesLoaded) return;
		const filters = JSON.stringify(resetScrollTrigger);
		if (previousFilters && previousFilters !== filters) untrack(resetTableScroll);
		previousFilters = filters;
	});

	$effect(() => {
		if (!preferencesLoaded) return;
		saved.current = {
			search,
			searchScope,
			countries,
			categories,
			articles,
			courts,
			years,
			viewMode,
			filterLayout,
			mapCollapsed,
			tableScrollTop,
			tableScrollLeft,
			windowScrollY,
			filterScrollTop,
			visited: true
		};
	});

	function rememberWindowScroll() {
		if (preferencesLoaded && isMobileViewport) windowScrollY = window.scrollY;
	}

	function restoreScroller(node: HTMLElement) {
		let active = true;
		let restored = false;
		$effect(() => {
			if (loading || !preferencesLoaded || restored) return;
			restored = true;
			const position = untrack(() => ({ top: tableScrollTop, left: tableScrollLeft }));
			tick().then(() => {
				if (!active) return;
				node.scrollTop = position.top;
				node.scrollLeft = position.left;
				tableViewportHeight = node.clientHeight;
			});
		});
		const observer = new ResizeObserver(() => {
			tableViewportHeight = node.clientHeight;
		});
		observer.observe(node);
		return {
			destroy() {
				active = false;
				observer.disconnect();
			}
		};
	}

	function rememberFilterScroll(node: HTMLElement) {
		const panel = node.firstElementChild as HTMLElement | null;
		if (!panel) return;
		let active = true;
		tick().then(() => {
			if (active) panel.scrollTop = filterScrollTop;
		});
		const remember = () => {
			filterScrollTop = panel.scrollTop;
		};
		panel.addEventListener('scroll', remember);
		return {
			destroy() {
				active = false;
				panel.removeEventListener('scroll', remember);
			}
		};
	}

	afterNavigate(() => {
		if (!preferencesLoaded || !isMobileViewport || !windowScrollY) return;
		disableScrollHandling();
		tick().then(() => {
			if (!disposed) window.scrollTo(0, windowScrollY);
		});
	});

	function loadPreferences() {
		if (!browser) return;

		const stored = localStorage.getItem(viewModeStorageKey);
		viewMode = stored === 'table' || stored === 'grid' || stored === 'map' ? stored : 'cards';

		const storedLayout = localStorage.getItem(filterLayoutStorageKey);
		filterLayout = storedLayout === 'top' ? storedLayout : 'left';
		const state = saved.current;
		if (state.visited) {
			search = state.search;
			searchScope = state.searchScope;
			countries = state.countries;
			categories = state.categories;
			articles = state.articles;
			courts = state.courts;
			years = state.years;
			viewMode = state.viewMode;
			filterLayout = state.filterLayout;
			mapCollapsed = state.mapCollapsed;
			tableScrollTop = state.tableScrollTop;
			tableScrollLeft = state.tableScrollLeft;
			windowScrollY = state.windowScrollY;
			filterScrollTop = state.filterScrollTop;
		}
		// Explicit incoming search/map links take precedence over remembered filters.
		if (page.url.searchParams.has('q')) search = page.url.searchParams.get('q') ?? '';
		if (page.url.searchParams.has('jurisdiction')) {
			countries = [normalizeJurisdiction(page.url.searchParams.get('jurisdiction') ?? '') ?? ''];
			search = page.url.searchParams.get('q') ?? '';
			searchScope = 'all';
			categories = [];
			articles = [];
			courts = [];
			years = [];
		}
		if (page.url.searchParams.has('map')) mapCollapsed = mapStartsCollapsed;
		if (page.url.searchParams.get('view') === 'map') viewMode = 'map';
		if (viewMode === 'grid') viewMode = 'cards';
		if (cardVariant === 'landing') searchScope = 'all';
		preferencesLoaded = true;
	}

	function uniqueSorted(values: (string | undefined)[]) {
		return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])].sort(
			(a, b) => a.localeCompare(b)
		);
	}

	function sortCases(records: CaseRecord[]) {
		return [...records].sort((a, b) => {
			if (sortOrder === 'title') return a.title.localeCompare(b.title);
			const aDate = a.decision_date ? new Date(a.decision_date).getTime() : 0;
			const bDate = b.decision_date ? new Date(b.decision_date).getTime() : 0;
			const difference = aDate - bDate;
			return sortOrder === 'oldest' ? difference : -difference;
		});
	}

	function countryLabel(country: string) {
		return country;
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
		const values = categories.length ? categories : (record.keywords ?? []);
		return [
			...new Set(
				values.map(
					(value) =>
						categoryOptions.find(
							(category) => category.toLowerCase() === value.trim().toLowerCase()
						) ?? value.trim()
				)
			)
		].filter((value) => categories.length || categoryOptions.includes(value));
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
		const deduped: Record<string, string> = {};

		for (const link of links
			.map(decodeHtmlEntities)
			.map((link) => link.trim())
			.filter(Boolean)) {
			const key = link.toLowerCase();
			deduped[key] ??= link;
		}

		return Object.values(deduped).sort((a, b) => sourceLabel(a).localeCompare(sourceLabel(b)));
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
			record.decision_reference,
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
			...(record.keywords ?? [])
		];
		const sourceValues = [
			stripHtml(record.summary),
			getTimeline(record),
			record.procedural_wording,
			record.source_limitations,
			...getPrimarySourcesList(record),
			...getSecondarySourcesList(record),
			record.commentary,
			...(record.document_links ?? [])
		];

		if (searchScope === 'case') return caseValues;
		if (searchScope === 'parties') return partyValues;
		if (searchScope === 'legal') return legalValues;
		if (searchScope === 'timeline') return [getTimeline(record), record.procedural_wording];
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
			(ignoredGroup === 'countries' ||
				matchesAny(countries, [normalizeJurisdiction(record.jurisdiction)])) &&
			(ignoredGroup === 'categories' || matchesAny(categories, getCategories(record))) &&
			(ignoredGroup === 'articles' || matchesAny(articles, record.dsa_articles ?? [])) &&
			(ignoredGroup === 'courts' || matchesAny(courts, [record.court])) &&
			(ignoredGroup === 'years' || matchesAny(years, [getDecisionYear(record)]))
		);
	}

	function optionCount(group: FilterGroup, option: string) {
		return browseCases.filter((record) => {
			if (!matchesFilters(record, group)) return false;
			if (group === 'countries') return matchesJurisdiction(record, option);
			if (group === 'categories') return getCategories(record).includes(option);
			if (group === 'articles') return (record.dsa_articles ?? []).includes(option);
			if (group === 'courts') return record.court === option;
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
			count: optionCount(group, option),
			...(group === 'countries' ? { country: option } : {})
		}));
	}

	function selectedFor(group: FilterGroup) {
		if (group === 'countries') return countries;
		if (group === 'categories') return categories;
		if (group === 'articles') return articles;
		if (group === 'courts') return courts;
		return years;
	}

	function toggleFilter(group: FilterGroup, value: string) {
		const selected = selectedFor(group);
		const next = selected.includes(value)
			? selected.filter((item) => item !== value)
			: [...selected, value];

		if (group === 'countries') countries = next;
		if (group === 'categories') categories = next;
		if (group === 'articles') articles = next;
		if (group === 'courts') courts = next;
		if (group === 'years') years = next;
	}

	function buildActiveChips() {
		const chips: ActiveFilterChip[] = [];
		const groups: FilterGroup[] = ['countries', 'categories', 'articles', 'courts', 'years'];

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
		countries = [];
		categories = [];
		articles = [];
		courts = [];
		years = [];
		resetTableScroll();
	}

	function setActiveTab(tab: 'browse' | 'saved') {
		activeTab = tab;
		if (tab === 'saved' && viewMode === 'map') viewMode = 'cards';
	}

	function toggleSavedCase(record: CaseRecord) {
		if (!cases.some((caseRecord) => caseRecord.id === record.id)) return;
		savedCaseIds = savedCaseIds.includes(record.id)
			? savedCaseIds.filter((id) => id !== record.id)
			: [...savedCaseIds, record.id];
		if (browser) localStorage.setItem(savedCasesStorageKey, JSON.stringify(savedCaseIds));
	}

	function loadSavedCases() {
		if (!browser) return;
		try {
			const saved = JSON.parse(localStorage.getItem(savedCasesStorageKey) ?? '[]');
			savedCaseIds = Array.isArray(saved)
				? saved.filter((id): id is string => typeof id === 'string')
				: [];
		} catch {
			savedCaseIds = [];
		}
	}

	function openFilters() {
		if (isMobileViewport) {
			mobileFiltersOpen = true;
			return;
		}
		const panel = Array.from(document.querySelectorAll<HTMLElement>('[data-case-filters]')).find(
			(candidate) => candidate.offsetParent !== null
		);
		panel?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		(panel?.querySelector('button') as HTMLButtonElement | null)?.focus();
	}

	function closeMobileFilters() {
		mobileFiltersOpen = false;
	}

	function resetTableScroll() {
		tableScrollTop = 0;
		tableScrollLeft = 0;
		if (tableScroller) tableScroller.scrollTop = 0;
		if (tableScroller) tableScroller.scrollLeft = 0;
	}

	function updateTableViewport() {
		if (!tableScroller) return;
		tableScrollTop = tableScroller.scrollTop;
		tableScrollLeft = tableScroller.scrollLeft;
		tableViewportHeight = tableScroller.clientHeight;
	}

	async function loadCases() {
		if (refreshing) {
			refreshAgain = true;
			return;
		}
		refreshing = true;
		const version = ++requestVersion;
		const key = casesCacheKey(publicationFilter === 'draft');
		loading = readCasesCache(key) === undefined;
		error = '';

		try {
			const records = await pb.collection('cases').getFullList<CaseRecord>({
				sort: '-decision_date,-created',
				filter:
					publicationFilter === 'draft'
						? "published = false && status != 'archived'"
						: "published = true && status != 'archived'"
			});
			if (
				disposed ||
				version !== requestVersion ||
				key !== casesCacheKey(publicationFilter === 'draft')
			)
				return;
			writeCasesCache(key, records);
			if (JSON.stringify(cases) !== JSON.stringify(records)) cases = records;
			const validSavedIds = savedCaseIds.filter((id) => records.some((record) => record.id === id));
			if (validSavedIds.length !== savedCaseIds.length) {
				savedCaseIds = validSavedIds;
				if (browser) localStorage.setItem(savedCasesStorageKey, JSON.stringify(savedCaseIds));
			}
		} catch (err) {
			if (disposed || version !== requestVersion) return;
			if (
				(err as { status?: number }).status === 401 ||
				(err as { status?: number }).status === 403
			) {
				cases = [];
				writeCasesCache(key, []);
			}
			console.error('Error loading cases:', err);
			error = 'Could not load cases. Check PocketBase availability and collection rules.';
		} finally {
			refreshing = false;
			if (!disposed && version === requestVersion) loading = false;
			if (!disposed && refreshAgain) {
				refreshAgain = false;
				void loadCases();
			}
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
			writeCasesCache(casesCacheKey(publicationFilter === 'draft'), cases);
			void loadCases();
		} catch (err) {
			console.error('Error deleting case:', err);
			error = 'Could not delete the case. Check your permissions.';
		}
	}

	async function downloadFilteredCases(format: 'xlsx' | 'csv' | 'json') {
		if (exporting || loading || !filteredCases.length) return;
		exporting = true;
		exportError = '';
		try {
			const rows = caseExportRows(
				filteredCases,
				(id) => `${window.location.origin}${resolve(`/cases/${id}`)}`
			);
			const blob =
				format === 'xlsx'
					? await caseExportExcel(rows)
					: new Blob([format === 'json' ? JSON.stringify(rows, null, 2) : caseExportCsv(rows)], {
							type: `${format === 'json' ? 'application/json' : 'text/csv'};charset=utf-8`
						});
			downloadBlob(`dsa-cases-${new Date().toISOString().slice(0, 10)}.${format}`, blob);
		} catch (err) {
			console.error('Could not export cases:', err);
			exportError = 'Could not export these cases. Please try again.';
		} finally {
			exporting = false;
		}
	}

	function downloadBlob(filename: string, blob: Blob) {
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		link.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	onMount(() => {
		playEntry = homeIntro && claimEntryAnimation('cases-tracker');
		// Do not animate sections mounted later by changing views or map controls.
		const entryTimer = playEntry
			? window.setTimeout(() => {
					playEntry = false;
				}, 1100)
			: undefined;
		const mediaQuery = window.matchMedia('(max-width: 767px)');
		const updateMobileViewport = () => {
			isMobileViewport = mediaQuery.matches;
		};

		updateMobileViewport();
		mediaQuery.addEventListener('change', updateMobileViewport);
		loadPreferences();
		loadSavedCases();
		const cached = readCasesCache(casesCacheKey(publicationFilter === 'draft'));
		if (cached !== undefined) {
			cases = cached;
			loading = false;
		}
		loadCases();
		const refresh = () => {
			void loadCases();
		};
		window.addEventListener('focus', refresh);
		const removeAuthListener = pb.authStore.onChange(() => {
			requestVersion++;
			cases = [];
			loading = true;
			refresh();
		});
		let unsubscribe: (() => void) | undefined;
		pb.collection('cases')
			.subscribe('*', refresh)
			.then((stop) => {
				if (disposed) stop();
				else unsubscribe = stop;
			})
			.catch(() => {
				/* Returning to the list and window focus still refresh it. */
			});

		return () => {
			if (entryTimer !== undefined) window.clearTimeout(entryTimer);
			disposed = true;
			requestVersion++;
			window.removeEventListener('focus', refresh);
			removeAuthListener();
			unsubscribe?.();
			mediaQuery.removeEventListener('change', updateMobileViewport);
		};
	});
</script>

{#snippet exportOptions()}
	<p class="px-2 py-1 text-xs text-slate-500" aria-live="polite">
		{exporting ? 'Preparing export…' : `${filteredCases.length} matching cases`}
	</p>
	{#each [['xlsx', 'Excel (.xlsx)'], ['csv', 'CSV'], ['json', 'JSON']] as [format, label] (format)}
		<button
			class="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
			type="button"
			disabled={exporting || loading || !filteredCases.length}
			onclick={() => downloadFilteredCases(format as 'xlsx' | 'csv' | 'json')}>{label}</button
		>
	{/each}
{/snippet}

<svelte:window
	onscroll={rememberWindowScroll}
	onkeydown={(event) => {
		if (event.key === 'Escape') closeMobileFilters();
	}}
/>

<section
	id="cases"
	class:cases-animated={playEntry}
	class="mx-auto flex w-full max-w-[1680px] flex-col px-4 pt-1 pb-4 sm:px-6 md:h-full md:min-h-0 md:overflow-hidden md:pt-3 lg:px-8"
>
	<div class="z-30 mb-3 flex-none space-y-2 md:mb-4 md:space-y-3">
		<div>
			{#if homeIntro}
				<div
					class="cases-entry cases-intro relative mb-3 overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-white via-sky-50 to-blue-100 shadow-sm shadow-slate-200/60"
				>
					<div class="pointer-events-none absolute inset-0 hidden sm:block" aria-hidden="true">
						<img
							src={asset('/maps/europe-banner.png')}
							alt=""
							class="h-full w-full object-fill opacity-50 saturate-[0.7]"
							draggable="false"
						/>
					</div>
					<div
						class="relative grid min-h-[158px] items-center gap-5 px-5 py-5 sm:px-6 md:grid-cols-[minmax(0,1fr)_21rem] md:gap-6 md:px-7 md:py-4"
					>
						<div class="min-w-0 md:max-w-[42rem]">
							<p class="text-xs font-black tracking-[0.28em] text-amber-500 uppercase">
								DSA Case Law Tracker
							</p>
							<h1
								class="mt-2 text-2xl leading-[1.08] font-black tracking-[-0.035em] text-slate-950 sm:text-3xl lg:text-4xl"
							>
								Private enforcement cases
							</h1>
							<p class="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
								Search, filter and compare private enforcement cases under the Digital Services Act.
							</p>
						</div>
						<div class="min-w-0">
							<div
								class="grid grid-cols-4 items-center rounded-xl border border-white/60 bg-white/65 px-2 py-5 shadow-sm shadow-sky-900/5 backdrop-blur-md sm:px-3"
							>
								<div class="px-2 text-left sm:px-3">
									<strong class="block text-xl leading-none font-bold tracking-tight text-slate-950"
										>{caseStats.cases}</strong
									>
									<span class="mt-1 block text-xs font-medium text-slate-600">cases</span>
								</div>
								<div class="border-l border-slate-200/80 px-2 text-left sm:px-3">
									<strong
										class="block text-base leading-none font-bold tracking-tight text-slate-900"
										>{caseStats.countries}</strong
									>
									<span class="mt-2 block text-xs font-normal text-slate-500">countries</span>
								</div>
								<div class="border-l border-slate-200/80 px-2 text-left sm:px-3">
									<strong
										class="block text-base leading-none font-bold tracking-tight text-slate-900"
										>{caseStats.courts}</strong
									>
									<span class="mt-2 block text-xs font-normal text-slate-500">courts</span>
								</div>
								<div class="border-l border-slate-200/80 px-2 text-left sm:px-3">
									<strong
										class="block text-base leading-none font-bold tracking-tight text-slate-900"
										>{caseStats.categories}</strong
									>
									<span class="mt-2 block text-xs font-normal text-slate-500">categories</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			{:else}
				<div class="sr-only md:not-sr-only md:mb-3 md:min-w-0">
					<h1 class="text-xl font-semibold tracking-tight text-slate-950 md:text-2xl">{heading}</h1>
					<p class="mt-1 text-sm text-slate-500">{description}</p>
				</div>
			{/if}
			<div
				class="cases-entry cases-toolbar rounded-lg border border-slate-200 bg-base-200/60 p-2 shadow-sm shadow-slate-200/60 backdrop-blur md:hidden"
			>
				<Search
					bind:value={search}
					bind:searchScope
					scopes={searchScopes}
					placeholder="Search cases, parties, articles, sources"
					navigateOnSubmit={false}
					variant="hero"
					showLabel={false}
					bare={true}
				/>

				<div class="mt-2 flex flex-wrap items-center justify-between gap-2">
					<div
						class="inline-flex items-center rounded-md border border-slate-200 bg-white/80 p-0.5 shadow-xs"
					>
						<button
							class={viewMode === 'grid' || viewMode === 'cards'
								? 'inline-flex h-7 items-center gap-1 rounded-sm bg-slate-100 px-2.5 text-xs font-semibold text-slate-950 transition'
								: 'inline-flex h-7 items-center gap-1 rounded-sm px-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800'}
							type="button"
							onclick={() => (viewMode = 'cards')}
							><IconGrid class="size-3.5" aria-hidden="true" /> List</button
						>
						<button
							class={viewMode === 'table'
								? 'inline-flex h-7 items-center gap-1 rounded-sm bg-slate-100 px-2.5 text-xs font-semibold text-slate-950 transition'
								: 'inline-flex h-7 items-center gap-1 rounded-sm px-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800'}
							type="button"
							onclick={() => (viewMode = 'table')}
							><IconTable class="size-3.5" aria-hidden="true" /> Table</button
						>
						{#if cardVariant === 'landing' && showMap}<button
								class={viewMode === 'map'
									? 'inline-flex h-7 items-center gap-1 rounded-sm bg-slate-900 px-2.5 text-xs font-semibold text-white transition'
									: 'inline-flex h-7 items-center gap-1 rounded-sm px-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800'}
								type="button"
								onclick={() => (viewMode = 'map')}
								><IconMap class="size-3.5" aria-hidden="true" /> Map</button
							>{/if}
					</div>

					<div class="flex items-center gap-1.5">
						<label class="relative">
							<IconArrowUpDown
								class="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-slate-400"
								aria-hidden="true"
							/>
							<select
								class="h-8 max-w-32 appearance-none rounded-md border border-slate-300 bg-white pr-6 pl-7 text-xs font-semibold text-slate-700"
								bind:value={sortOrder}
								aria-label="Sort cases"
							>
								<option value="recent">Recent</option><option value="oldest">Oldest</option><option
									value="title">Title A–Z</option
								>
							</select>
							<IconChevronDown
								class="pointer-events-none absolute top-1/2 right-2 size-3 -translate-y-1/2 text-slate-400"
								aria-hidden="true"
							/>
						</label>
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
								{@render exportOptions()}
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
							onclick={openFilters}
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

			{#if cardVariant !== 'landing'}
				<div class="cases-entry cases-toolbar hidden md:block">
					<Search
						bind:value={search}
						bind:searchScope
						scopes={searchScopes}
						placeholder="Search cases, parties, articles, sources"
						navigateOnSubmit={false}
						variant="hero"
						showLabel={false}
						bare={true}
					>
						{#snippet trailing()}
							<select
								class="h-8 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-xs focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:outline-none"
								bind:value={sortOrder}
								aria-label="Sort cases"
							>
								<option value="recent">Most recent</option>
								<option value="oldest">Oldest first</option>
								<option value="title">Title A–Z</option>
							</select>
							<div
								class="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs"
							>
								<button
									class={viewMode === 'grid' || viewMode === 'cards'
										? 'h-7 rounded-md bg-slate-900 px-2.5 text-xs font-semibold text-white'
										: 'h-7 rounded-md px-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
									type="button"
									aria-pressed={viewMode === 'grid' || viewMode === 'cards'}
									onclick={() => (viewMode = 'cards')}>List</button
								>
								<button
									class={viewMode === 'table'
										? 'h-7 rounded-md bg-slate-100 px-2.5 text-xs font-semibold text-slate-950'
										: 'h-7 rounded-md px-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
									type="button"
									aria-pressed={viewMode === 'table'}
									onclick={() => (viewMode = 'table')}>Table</button
								>
								{#if cardVariant === 'landing' && showMap}<button
										class={viewMode === 'map'
											? 'h-7 rounded-md bg-slate-100 px-2.5 text-xs font-semibold text-slate-950'
											: 'h-7 rounded-md px-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
										type="button"
										aria-pressed={viewMode === 'map'}
										onclick={() => (viewMode = 'map')}>Map</button
									>{/if}
							</div>
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
									{@render exportOptions()}
								</div>
							</details>
							{#if canWrite}<button
									class="btn h-8 min-h-0 rounded-md px-3 text-xs font-semibold whitespace-nowrap btn-primary"
									type="button"
									onclick={() => goto(resolve('/cases/new'))}>Create case</button
								>{/if}
						{/snippet}
					</Search>
				</div>
				<div class="hidden items-center justify-between gap-3 md:flex lg:hidden">
					<p class="min-w-0 text-sm text-slate-500">
						Showing <span class="font-medium text-slate-900">{filteredCases.length}</span> of {cases.length}
						cases
					</p>
				</div>
				{#if activeChips.length > 0 || search.trim()}<div
						class="cases-entry flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2.5"
					>
						<div class="flex min-w-0 flex-wrap items-center gap-1.5">
							{#each activeChips as chip (`${chip.group}:${chip.value}`)}
								<button
									class="inline-flex h-7 max-w-44 items-center gap-1 truncate rounded-full border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
									type="button"
									onclick={() => toggleFilter(chip.group, chip.value)}
									title={`Remove ${chip.label} filter`}
								>
									<span class="truncate">{chip.label}</span><span aria-hidden="true">×</span>
								</button>
							{/each}
							{#if search.trim()}<button
									class="inline-flex h-7 max-w-44 items-center gap-1 truncate rounded-full border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
									type="button"
									onclick={() => (search = '')}
									><span class="truncate">Search: {search}</span><span aria-hidden="true">×</span
									></button
								>{/if}
						</div>
					</div>{/if}

				{#if filterLayout === 'top'}
					<div class="hidden md:block">
						<CaseFilterPanel sidebar={false} {...filterPanelProps} />
					</div>
				{:else}
					<div class="hidden md:block lg:hidden">
						<CaseFilterPanel sidebar={false} {...filterPanelProps} />
					</div>
				{/if}
			{/if}
		</div>
	</div>

	{#if exportError}<p role="alert" class="mb-3 text-sm text-red-700">{exportError}</p>{/if}
	{#if error}
		<div
			class="mb-4 flex-none rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
		>
			{error}
		</div>
	{/if}

	<div
		class={cardVariant === 'landing'
			? 'grid min-w-0 gap-4 md:min-h-0 md:flex-1 lg:grid-cols-[17.5rem_minmax(0,1fr)]'
			: filterLayout === 'left'
				? 'grid min-w-0 gap-4 md:min-h-0 md:flex-1 lg:grid-cols-[17.5rem_minmax(0,1fr)]'
				: 'min-w-0 md:min-h-0 md:flex-1'}
	>
		{#if cardVariant === 'landing' || filterLayout === 'left'}
			<aside
				use:rememberFilterScroll
				class="cases-entry cases-filters hidden min-h-0 min-w-0 overflow-hidden lg:block"
			>
				<CaseFilterPanel sidebar={true} {...filterPanelProps} />
			</aside>
		{/if}
		<div
			class="cases-entry cases-results min-w-0 md:flex md:h-full md:min-h-0 md:flex-col md:overflow-hidden"
		>
			{#if cardVariant === 'landing'}
				<div class="mb-3 hidden flex-none space-y-2 md:block">
					<div class="flex min-w-0 items-center gap-2">
						<div class="min-w-0 flex-1">
							<Search
								bind:value={search}
								placeholder="Search cases, parties, articles, sources"
								navigateOnSubmit={false}
								variant="hero"
								showLabel={false}
								bare={true}
							/>
						</div>
						<label class="relative shrink-0">
							<span class="sr-only">Sort cases</span>
							<IconArrowUpDown
								class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
								aria-hidden="true"
							/>
							<select
								class="h-10 appearance-none rounded-lg border border-slate-200 bg-white py-0 pr-9 pl-9 text-sm font-semibold text-slate-700 shadow-xs transition outline-none hover:border-slate-300 focus:ring-2 focus:ring-slate-900/10"
								bind:value={sortOrder}
							>
								<option value="recent">Most recent</option>
								<option value="oldest">Oldest first</option>
								<option value="title">Title A–Z</option>
							</select>
							<IconChevronDown
								class="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400"
								aria-hidden="true"
							/>
						</label>
						<div
							class="inline-flex h-10 shrink-0 items-center rounded-lg border border-slate-200 bg-white p-1 shadow-xs"
						>
							<button
								class={viewMode === 'grid' || viewMode === 'cards'
									? 'inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-200 px-3 text-sm font-semibold text-slate-700'
									: 'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-950'}
								type="button"
								aria-pressed={viewMode === 'grid' || viewMode === 'cards'}
								onclick={() => (viewMode = 'cards')}
								><IconGrid class="size-4" aria-hidden="true" /> List</button
							>
							<button
								class={viewMode === 'table'
									? 'inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-200 px-3 text-sm font-semibold text-slate-700'
									: 'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-950'}
								type="button"
								aria-pressed={viewMode === 'table'}
								onclick={() => (viewMode = 'table')}
								><IconTable class="size-4" aria-hidden="true" /> Table</button
							>
							{#if showMap}<button
									class={viewMode === 'map'
										? 'inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-200 px-3 text-sm font-semibold text-slate-700'
										: 'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-950'}
									type="button"
									aria-pressed={viewMode === 'map'}
									onclick={() => (viewMode = 'map')}
									><IconMap class="size-4" aria-hidden="true" /> Map</button
								>{/if}
						</div>
						<details class="relative shrink-0">
							<summary
								class="inline-flex h-10 cursor-pointer list-none items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-xs hover:border-slate-300"
								>Export <IconChevronDown class="size-3.5" aria-hidden="true" /></summary
							>
							<div
								class="absolute right-0 z-50 mt-1 min-w-32 rounded-md border border-slate-200 bg-white p-1 shadow-lg"
							>
								{@render exportOptions()}
							</div>
						</details>
						{#if canWrite}<button
								class="btn h-10 min-h-0 shrink-0 rounded-md px-3 text-xs font-semibold whitespace-nowrap btn-primary"
								type="button"
								onclick={() => goto(resolve('/cases/new'))}>Create case</button
							>{/if}
					</div>

					{#if activeChips.length > 0 || search.trim()}<div
							class="flex min-h-8 flex-wrap items-center gap-2"
						>
							<div class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
								{#each activeChips as chip (`${chip.group}:${chip.value}`)}
									<button
										class="inline-flex h-7 max-w-48 items-center gap-1 rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200 hover:text-slate-950"
										type="button"
										onclick={() => toggleFilter(chip.group, chip.value)}
										title={`Remove ${chip.label} filter`}
										><span class="truncate">{chip.label}</span><span aria-hidden="true">×</span
										></button
									>
								{/each}
								{#if search.trim()}<button
										class="inline-flex h-7 max-w-48 items-center gap-1 rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-200 hover:text-slate-950"
										type="button"
										onclick={() => (search = '')}
										><span class="truncate">Search: {search}</span><span aria-hidden="true">×</span
										></button
									>{/if}
							</div>
						</div>{/if}
				</div>
				<div class="hidden flex-none md:block lg:hidden">
					<CaseFilterPanel sidebar={false} {...filterPanelProps} />
				</div>
			{/if}
			{#if cardVariant === 'landing' && viewMode === 'map' && showMap}
				<div
					class="min-h-0 flex-1 rounded-xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/70"
				>
					<CaseJurisdictionMap
						cases={filteredCases}
						collapsed={false}
						compact={true}
						bare={true}
						fill={true}
						showList={false}
						showToggle={false}
					/>
				</div>
			{:else if viewMode !== 'table'}
				<div
					bind:this={tableScroller}
					use:restoreScroller
					class={cardVariant === 'landing'
						? 'max-w-full overflow-visible md:min-h-0 md:flex-1 md:overflow-auto'
						: 'max-w-full overflow-visible rounded-xl border border-slate-200 bg-base-200/60 p-3 shadow-sm shadow-slate-200/70 md:h-full md:min-h-0 md:overflow-auto'}
					onscroll={updateTableViewport}
				>
					{#if cardVariant === 'landing'}
						<CaseBrowseCards
							{...resultProps}
							layout={viewMode === 'grid' ? 'grid' : 'list'}
							{savedCaseIds}
							emptySaved={activeTab === 'saved' && savedCaseIds.length === 0}
							onToggleSaved={toggleSavedCase}
							onEdit={editCase}
							{countryLabel}
							{getCategories}
							{sourceLinks}
							{sourceLabel}
						/>
					{:else}
						<CaseCardsList
							{...resultProps}
							{getPartyValues}
							{countryLabel}
							{getCategories}
							{getTimeline}
							{getPrimarySourcesList}
							{getSecondarySourcesList}
							{sourceLinks}
							{sourceLabel}
						/>
					{/if}
				</div>
			{:else}
				<div
					bind:this={tableScroller}
					use:restoreScroller
					class={cardVariant === 'landing'
						? 'max-w-full overflow-x-auto overflow-y-visible rounded-xl border border-slate-200 bg-base-200/60 p-2 shadow-sm shadow-slate-200/70 md:min-h-0 md:flex-1 md:overflow-auto'
						: 'max-w-full overflow-x-auto overflow-y-visible rounded-xl border border-slate-200 bg-base-200/60 p-2 shadow-sm shadow-slate-200/70 md:h-full md:min-h-0 md:overflow-auto'}
					onscroll={updateTableViewport}
				>
					<CaseResultsTable
						{...resultProps}
						{getCategories}
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

<style>
	@media (prefers-reduced-motion: no-preference) {
		.cases-animated .cases-entry {
			animation: cases-enter 0.75s cubic-bezier(0.16, 1, 0.3, 1) backwards;
		}
		.cases-animated .cases-toolbar {
			animation-delay: 0.1s;
		}
		.cases-animated .cases-filters {
			animation-delay: 0.18s;
		}
		.cases-animated .cases-results {
			animation-delay: 0.25s;
		}
	}
	@keyframes cases-enter {
		from {
			opacity: 0;
			transform: translateY(16px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
