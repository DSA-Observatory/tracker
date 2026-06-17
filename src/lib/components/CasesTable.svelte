<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import type { FilterOption } from '$lib/components/FilterMenu.svelte';
	import CaseCardsList from '$lib/components/cases/CaseCardsList.svelte';
	import CaseFilterPanel from '$lib/components/cases/CaseFilterPanel.svelte';
	import CaseResultsTable from '$lib/components/cases/CaseResultsTable.svelte';
	import CaseVisualizationControls from '$lib/components/cases/CaseVisualizationControls.svelte';
	import type {
		ActiveFilterChip,
		FilterGroup,
		FilterLayout,
		SearchScope,
		ViewMode
	} from '$lib/components/cases/types';
	import { authStore, pb, type CaseRecord, type CaseStatus } from '$lib/database';

	const statusOptions: CaseStatus[] = [
		'draft',
		'review',
		'pending',
		'decided',
		'appealed',
		'closed',
		'published'
	];
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

	type CaseForm = {
		case_id: string;
		title: string;
		ecli: string;
		decision_date: string;
		status: CaseStatus;
		court: string;
		jurisdiction: string;
		plaintiffs: string;
		defendants: string;
		summary: string;
		keywords: string;
		dsa_articles: string;
		published: boolean;
	};

	const emptyForm = (): CaseForm => ({
		case_id: '',
		title: '',
		ecli: '',
		decision_date: '',
		status: 'draft',
		court: '',
		jurisdiction: '',
		plaintiffs: '',
		defendants: '',
		summary: '',
		keywords: '',
		dsa_articles: '',
		published: false
	});

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
	let saving = $state(false);
	let error = $state('');
	let editingId = $state<string | null>(null);
	let form = $state<CaseForm>(emptyForm());
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
	const rowHeight = $derived(viewMode === 'cards' ? 132 : 176);
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

	const splitList = (value: string) =>
		value
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);

	const joinList = (value?: string[]) => (Array.isArray(value) ? value.join(', ') : '');

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
		editingId = record.id;
		form = {
			case_id: record.case_id,
			title: record.title,
			ecli: record.ecli ?? '',
			decision_date: record.decision_date ? record.decision_date.slice(0, 10) : '',
			status: record.status,
			court: record.court ?? '',
			jurisdiction: record.jurisdiction ?? '',
			plaintiffs: joinList(record.plaintiffs),
			defendants: joinList(record.defendants),
			summary: record.summary ?? '',
			keywords: joinList(record.keywords),
			dsa_articles: joinList(record.dsa_articles),
			published: record.published
		};
	}

	function resetForm() {
		editingId = null;
		form = emptyForm();
	}

	async function saveCase() {
		if (!form.case_id.trim() || !form.title.trim()) return;

		saving = true;
		error = '';

		const payload = {
			case_id: form.case_id.trim(),
			title: form.title.trim(),
			ecli: form.ecli.trim(),
			decision_date: form.decision_date || null,
			status: form.status,
			court: form.court.trim(),
			jurisdiction: form.jurisdiction.trim(),
			plaintiffs: splitList(form.plaintiffs),
			defendants: splitList(form.defendants),
			summary: form.summary.trim(),
			keywords: splitList(form.keywords),
			dsa_articles: splitList(form.dsa_articles),
			published: form.published || form.status === 'published'
		};

		try {
			if (editingId) {
				await pb.collection('cases').update<CaseRecord>(editingId, payload);
			} else {
				await pb.collection('cases').create<CaseRecord>(payload);
			}

			resetForm();
			await loadCases();
		} catch (err) {
			console.error('Error saving case:', err);
			error = 'Could not save the case. Check required fields and permissions.';
		} finally {
			saving = false;
		}
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
	class="mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pt-4 pb-4 sm:px-6 lg:px-8"
>
	<div class="z-30 mb-4 flex-none bg-base-100">
		<div class="mb-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_220px] lg:items-center">
			<label class="input-bordered input flex items-center gap-2">
				<span class="text-base-content/50">Search</span>
				<input
					class="grow"
					type="search"
					bind:value={search}
					placeholder="Search cases, parties, articles, sources"
				/>
			</label>
			<CaseVisualizationControls
				{viewMode}
				{filterLayout}
				onViewModeChange={(mode) => (viewMode = mode)}
				onFilterLayoutChange={(layout) => (filterLayout = layout)}
			/>
			<select
				class="select-bordered select w-full"
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

	{#if canWrite}
		<form
			class="mb-8 flex-none rounded-[2rem] border border-base-300 bg-base-100 p-5 shadow-sm"
			onsubmit={(event) => {
				event.preventDefault();
				saveCase();
			}}
		>
			<div class="mb-4 flex items-center justify-between gap-3">
				<h3 class="text-xl font-black">{editingId ? 'Edit case' : 'Create case'}</h3>
				{#if editingId}
					<button class="btn btn-ghost btn-sm" type="button" onclick={resetForm}>Cancel edit</button
					>
				{/if}
			</div>

			<div class="grid gap-3 md:grid-cols-3">
				<input
					class="input-bordered input"
					bind:value={form.case_id}
					required
					placeholder="Case ID"
				/>
				<input
					class="input-bordered input md:col-span-2"
					bind:value={form.title}
					required
					placeholder="Case title"
				/>
				<input
					class="input-bordered input"
					bind:value={form.ecli}
					placeholder="ECLI or identifier"
				/>
				<input class="input-bordered input" bind:value={form.court} placeholder="Court" />
				<input
					class="input-bordered input"
					bind:value={form.jurisdiction}
					placeholder="Jurisdiction"
				/>
				<input
					class="input-bordered input"
					bind:value={form.decision_date}
					type="date"
					aria-label="Decision date"
				/>
				<select class="select-bordered select" bind:value={form.status}>
					{#each statusOptions as option}
						<option value={option}>{option}</option>
					{/each}
				</select>
				<label
					class="label cursor-pointer justify-start gap-3 rounded-lg border border-base-300 px-4"
				>
					<input class="checkbox checkbox-primary" type="checkbox" bind:checked={form.published} />
					<span class="label-text">Published</span>
				</label>
				<input
					class="input-bordered input"
					bind:value={form.plaintiffs}
					placeholder="Plaintiffs, comma separated"
				/>
				<input
					class="input-bordered input"
					bind:value={form.defendants}
					placeholder="Defendants, comma separated"
				/>
				<input
					class="input-bordered input"
					bind:value={form.dsa_articles}
					placeholder="DSA articles, comma separated"
				/>
				<input
					class="input-bordered input md:col-span-3"
					bind:value={form.keywords}
					placeholder="Keywords, comma separated"
				/>
				<textarea
					class="textarea-bordered textarea md:col-span-3"
					bind:value={form.summary}
					rows="3"
					placeholder="Editorial summary"
				></textarea>
			</div>

			<div class="mt-4 flex justify-end">
				<button
					class="btn btn-primary"
					type="submit"
					disabled={saving || !form.case_id.trim() || !form.title.trim()}
				>
					{saving ? 'Saving...' : editingId ? 'Update case' : 'Create case'}
				</button>
			</div>
		</form>
	{/if}

	{#if error}
		<div class="mb-5 alert flex-none alert-error">{error}</div>
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
		<div class="min-h-0 min-w-0">
			{#if viewMode !== 'table'}
				<div
					bind:this={tableScroller}
					class="h-full min-h-0 max-w-full overflow-auto border border-base-300/70 bg-base-200/30 p-3 shadow-sm"
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
					class="h-full min-h-0 max-w-full overflow-auto border border-base-300 bg-base-100 shadow-sm"
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
