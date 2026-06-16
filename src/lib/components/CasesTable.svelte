<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import FilterMenu, { type FilterOption } from '$lib/components/FilterMenu.svelte';
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
	type FilterGroup =
		| 'statuses'
		| 'countries'
		| 'categories'
		| 'themes'
		| 'articles'
		| 'courts'
		| 'parties'
		| 'years';
	type SearchScope =
		| 'all'
		| 'case'
		| 'parties'
		| 'legal'
		| 'sources'
		| 'timeline'
		| 'primary'
		| 'secondary';

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

	const canWrite = $derived(authStore.isAuthenticated);
	const selectedFilterCount = $derived(
		statuses.length +
			countries.length +
			categories.length +
			themes.length +
			articles.length +
			courts.length +
			parties.length +
			years.length
	);
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

	const splitList = (value: string) =>
		value
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);

	const joinList = (value?: string[]) => (Array.isArray(value) ? value.join(', ') : '');

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
		const chips: { group: FilterGroup; value: string; label: string }[] = [];
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

	onMount(loadCases);
</script>

<section id="cases" class="container mx-auto max-w-7xl px-4 py-16">
	<div class="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
		<div>
			<p class="text-sm font-semibold tracking-[0.25em] text-primary uppercase">Case database</p>
			<h2 class="mt-3 text-3xl font-black">Search and maintain the tracker list.</h2>
			<p class="mt-3 max-w-2xl text-base-content/70">
				Published cases are public. Signed-in editors can create, update, and delete records
				directly in this table.
			</p>
		</div>
	</div>

	<div class="mb-6 grid gap-3 lg:grid-cols-[1fr_220px]">
		<label class="input-bordered input flex items-center gap-2">
			<span class="text-base-content/50">Search</span>
			<input
				class="grow"
				type="search"
				bind:value={search}
				placeholder="Search cases, parties, articles, sources"
			/>
		</label>
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

	<div class="mb-6 rounded-[2rem] border border-base-300 bg-base-100 p-4 shadow-sm">
		<div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<p class="text-xs font-semibold tracking-[0.2em] text-base-content/50 uppercase">
					Filter cases
				</p>
				<p class="text-sm text-base-content/70">
					Showing {filteredCases.length} of {cases.length} cases
				</p>
			</div>
			{#if selectedFilterCount || search}
				<button class="btn btn-ghost btn-sm" type="button" onclick={clearFilters}
					>Clear filters</button
				>
			{/if}
		</div>

		<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
			<FilterMenu
				label="Status"
				options={statusFilterOptions}
				selected={statuses}
				placeholder="Search statuses"
				onToggle={(value) => toggleFilter('statuses', value)}
			/>
			<FilterMenu
				label="Country"
				options={countryFilterOptions}
				selected={countries}
				placeholder="Search countries"
				onToggle={(value) => toggleFilter('countries', value)}
			/>
			<FilterMenu
				label="Category"
				options={categoryFilterOptions}
				selected={categories}
				placeholder="Search categories"
				onToggle={(value) => toggleFilter('categories', value)}
			/>
			<FilterMenu
				label="Theme"
				options={themeFilterOptions}
				selected={themes}
				placeholder="Search themes"
				onToggle={(value) => toggleFilter('themes', value)}
			/>
			<FilterMenu
				label="DSA provisions"
				options={articleFilterOptions}
				selected={articles}
				placeholder="Search DSA provisions"
				onToggle={(value) => toggleFilter('articles', value)}
			/>
			<FilterMenu
				label="Court"
				options={courtFilterOptions}
				selected={courts}
				placeholder="Search courts"
				onToggle={(value) => toggleFilter('courts', value)}
			/>
			<FilterMenu
				label="Parties"
				options={partyFilterOptions}
				selected={parties}
				placeholder="Search plaintiffs or defendants"
				onToggle={(value) => toggleFilter('parties', value)}
			/>
			<FilterMenu
				label="Decision year"
				options={yearFilterOptions}
				selected={years}
				placeholder="Search years"
				onToggle={(value) => toggleFilter('years', value)}
			/>
		</div>

		{#if activeChips.length > 0}
			<div class="mt-4 flex flex-wrap gap-2">
				{#each activeChips as chip}
					<button
						class="badge gap-2 badge-outline py-3"
						type="button"
						onclick={() => toggleFilter(chip.group, chip.value)}
					>
						{chip.label}
						<span aria-hidden="true">×</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if canWrite}
		<form
			class="mb-8 rounded-[2rem] border border-base-300 bg-base-100 p-5 shadow-sm"
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
		<div class="mb-5 alert alert-error">{error}</div>
	{/if}

	<div class="overflow-x-auto rounded-[2rem] border border-base-300 bg-base-100 shadow-sm">
		<table class="table table-zebra">
			<thead>
				<tr>
					<th>Case</th>
					<th>Status</th>
					<th>Jurisdiction</th>
					<th>Court</th>
					<th>Decision</th>
					<th>Tags</th>
					{#if canWrite}<th class="text-right">Actions</th>{/if}
				</tr>
			</thead>
			<tbody>
				{#if loading}
					<tr>
						<td colspan={canWrite ? 7 : 6}>Loading cases...</td>
					</tr>
				{:else if filteredCases.length === 0}
					<tr>
						<td colspan={canWrite ? 7 : 6}>No cases found.</td>
					</tr>
				{:else}
					{#each filteredCases as record (record.id)}
						<tr>
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
							<td><span class="badge badge-outline">{record.status}</span></td>
							<td>
								{#if record.jurisdiction}
									<span class="inline-flex items-center gap-2 whitespace-nowrap">
										{#if countryFlag(record.jurisdiction)}<span
												>{countryFlag(record.jurisdiction)}</span
											>{/if}
										<span>{record.jurisdiction}</span>
									</span>
								{:else}
									-
								{/if}
							</td>
							<td>{record.court || '-'}</td>
							<td
								>{record.decision_date
									? new Date(record.decision_date).toLocaleDateString()
									: '-'}</td
							>
							<td class="min-w-56">
								<div class="flex flex-wrap gap-1">
									{#each [...(record.dsa_articles ?? []), ...(record.keywords ?? [])].slice(0, 5) as tag}
										<span class="badge badge-ghost">{tag}</span>
									{/each}
								</div>
							</td>
							{#if canWrite}
								<td class="text-right">
									<div class="join">
										<button
											class="btn join-item btn-sm"
											type="button"
											onclick={() => editCase(record)}
										>
											Edit
										</button>
										<button
											class="btn join-item btn-sm btn-error"
											type="button"
											onclick={() => deleteCase(record)}
										>
											Delete
										</button>
									</div>
								</td>
							{/if}
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</section>
