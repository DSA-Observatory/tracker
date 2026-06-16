<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { page } from '$app/state';
	import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';
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
	type FilterGroup = 'countries' | 'categories' | 'themes';

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
	let status = $state('');
	let countries = $state<string[]>([]);
	let categories = $state<string[]>([]);
	let themes = $state<string[]>([]);
	let openFilter = $state<FilterGroup | null>(null);
	let countryOptionSearch = $state('');
	let categoryOptionSearch = $state('');
	let themeOptionSearch = $state('');
	let countryButton = $state<HTMLElement>();
	let countryMenu = $state<HTMLElement>();
	let categoryButton = $state<HTMLElement>();
	let categoryMenu = $state<HTMLElement>();
	let themeButton = $state<HTMLElement>();
	let themeMenu = $state<HTMLElement>();
	let countryMenuStyle = $state('');
	let categoryMenuStyle = $state('');
	let themeMenuStyle = $state('');
	let cleanupFloating: (() => void) | undefined;
	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');
	let editingId = $state<string | null>(null);
	let form = $state<CaseForm>(emptyForm());

	const canWrite = $derived(authStore.isAuthenticated);
	const selectedFilterCount = $derived(
		countries.length + categories.length + themes.length + (status ? 1 : 0)
	);
	const availableCountries = $derived(uniqueSorted(cases.map((record) => record.jurisdiction)));
	const availableCategories = $derived(
		categoryOptions.filter((category) => cases.some((record) => hasKeyword(record, category)))
	);
	const availableThemes = $derived(
		uniqueSorted(
			cases.flatMap((record) =>
				(record.keywords ?? []).filter((keyword) => !categoryOptions.includes(keyword))
			)
		)
	);
	const visibleCountries = $derived(filterOptions(availableCountries, countryOptionSearch));
	const visibleCategories = $derived(filterOptions(availableCategories, categoryOptionSearch));
	const visibleThemes = $derived(filterOptions(availableThemes, themeOptionSearch));
	const filteredCases = $derived(cases.filter((record) => matchesFilters(record)));

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

	function filterOptions(options: string[], query: string) {
		const normalizedQuery = query.trim().toLowerCase();
		if (!normalizedQuery) return options;
		return options.filter((option) => option.toLowerCase().includes(normalizedQuery));
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

	function matchesSearch(record: CaseRecord) {
		const query = search.trim().toLowerCase();
		if (!query) return true;

		return [
			record.case_id,
			record.title,
			record.ecli,
			record.court,
			record.jurisdiction,
			record.summary,
			...(record.keywords ?? []),
			...(record.dsa_articles ?? [])
		]
			.filter(Boolean)
			.some((value) => String(value).toLowerCase().includes(query));
	}

	function matchesFilters(record: CaseRecord, ignoredGroup?: FilterGroup) {
		return (
			matchesSearch(record) &&
			(!status || record.status === status) &&
			(ignoredGroup === 'countries' || matchesAny(countries, [record.jurisdiction])) &&
			(ignoredGroup === 'categories' || matchesAny(categories, record.keywords ?? [])) &&
			(ignoredGroup === 'themes' || matchesAny(themes, record.keywords ?? []))
		);
	}

	function optionCount(group: FilterGroup, option: string) {
		return cases.filter((record) => {
			if (!matchesFilters(record, group)) return false;
			if (group === 'countries') return record.jurisdiction === option;
			return hasKeyword(record, option);
		}).length;
	}

	function optionSelected(group: FilterGroup, option: string) {
		if (group === 'countries') return countries.includes(option);
		if (group === 'categories') return categories.includes(option);
		return themes.includes(option);
	}

	function toggleFilter(group: FilterGroup, value: string) {
		const selected =
			group === 'countries' ? countries : group === 'categories' ? categories : themes;
		const next = selected.includes(value)
			? selected.filter((item) => item !== value)
			: [...selected, value];

		if (group === 'countries') countries = next;
		if (group === 'categories') categories = next;
		if (group === 'themes') themes = next;
	}

	function clearFilters() {
		search = '';
		status = '';
		countries = [];
		categories = [];
		themes = [];
		countryOptionSearch = '';
		categoryOptionSearch = '';
		themeOptionSearch = '';
	}

	function getDropdownElements(group: FilterGroup) {
		if (group === 'countries') return { button: countryButton, menu: countryMenu };
		if (group === 'categories') return { button: categoryButton, menu: categoryMenu };
		return { button: themeButton, menu: themeMenu };
	}

	function setMenuStyle(group: FilterGroup, style: string) {
		if (group === 'countries') countryMenuStyle = style;
		if (group === 'categories') categoryMenuStyle = style;
		if (group === 'themes') themeMenuStyle = style;
	}

	async function updateFloatingPosition(group: FilterGroup) {
		await tick();
		const { button, menu } = getDropdownElements(group);
		if (!button || !menu) return;

		const { x, y } = await computePosition(button, menu, {
			placement: 'bottom-start',
			middleware: [offset(8), flip(), shift({ padding: 16 })],
			strategy: 'fixed'
		});

		setMenuStyle(
			group,
			`position: fixed; left: ${x}px; top: ${y}px; width: ${Math.min(Math.max(button.offsetWidth, 320), window.innerWidth - 32)}px;`
		);
	}

	async function toggleDropdown(group: FilterGroup) {
		cleanupFloating?.();
		cleanupFloating = undefined;

		if (openFilter === group) {
			openFilter = null;
			return;
		}

		openFilter = group;
		await updateFloatingPosition(group);

		const { button, menu } = getDropdownElements(group);
		if (button && menu) {
			cleanupFloating = autoUpdate(button, menu, () => updateFloatingPosition(group));
		}
	}

	function closeDropdown() {
		cleanupFloating?.();
		cleanupFloating = undefined;
		openFilter = null;
	}

	function handleDocumentClick(event: MouseEvent) {
		if (!openFilter) return;
		const { button, menu } = getDropdownElements(openFilter);
		const target = event.target as Node;
		if (button?.contains(target) || menu?.contains(target)) return;
		closeDropdown();
	}

	function handleDocumentKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') closeDropdown();
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
		loadCases();
		document.addEventListener('click', handleDocumentClick);
		document.addEventListener('keydown', handleDocumentKeydown);

		return () => {
			document.removeEventListener('click', handleDocumentClick);
			document.removeEventListener('keydown', handleDocumentKeydown);
			cleanupFloating?.();
		};
	});
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
				placeholder="Title, ECLI, court, jurisdiction, summary"
			/>
		</label>
		<select class="select-bordered select w-full" bind:value={status}>
			<option value="">All statuses</option>
			{#each statusOptions as option}
				<option value={option}>{option}</option>
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

		<div class="grid gap-3 md:grid-cols-3">
			<div class="w-full">
				<button
					bind:this={countryButton}
					class="btn w-full justify-between btn-outline"
					type="button"
					aria-expanded={openFilter === 'countries'}
					onclick={() => toggleDropdown('countries')}
				>
					Country
					<span class="badge badge-primary">{countries.length || availableCountries.length}</span>
				</button>
				{#if openFilter === 'countries'}
					<div
						bind:this={countryMenu}
						class="z-50 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl"
						style={countryMenuStyle}
						role="menu"
					>
						<input
							class="input-bordered input input-sm mb-2 w-full"
							type="search"
							bind:value={countryOptionSearch}
							placeholder="Search countries"
							aria-label="Search countries"
						/>
						<div class="max-h-64 overflow-y-auto">
							{#each visibleCountries as option}
								<label
									class="label flex cursor-pointer justify-between gap-3 rounded-lg px-2 hover:bg-base-200"
								>
									<span class="flex min-w-0 items-center gap-3">
										<input
											class="checkbox checkbox-sm checkbox-primary"
											type="checkbox"
											checked={optionSelected('countries', option)}
											onchange={() => toggleFilter('countries', option)}
										/>
										<span class="label-text flex min-w-0 items-center gap-2 whitespace-nowrap">
											{#if countryFlag(option)}<span>{countryFlag(option)}</span>{/if}
											<span class="truncate">{option}</span>
										</span>
									</span>
									<span class="badge badge-ghost badge-sm">{optionCount('countries', option)}</span>
								</label>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<div class="w-full">
				<button
					bind:this={categoryButton}
					class="btn w-full justify-between btn-outline"
					type="button"
					aria-expanded={openFilter === 'categories'}
					onclick={() => toggleDropdown('categories')}
				>
					Category
					<span class="badge badge-primary">{categories.length || availableCategories.length}</span>
				</button>
				{#if openFilter === 'categories'}
					<div
						bind:this={categoryMenu}
						class="z-50 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl"
						style={categoryMenuStyle}
						role="menu"
					>
						<input
							class="input-bordered input input-sm mb-2 w-full"
							type="search"
							bind:value={categoryOptionSearch}
							placeholder="Search categories"
							aria-label="Search categories"
						/>
						<div class="max-h-64 overflow-y-auto">
							{#each visibleCategories as option}
								<label
									class="label flex cursor-pointer justify-between gap-3 rounded-lg px-2 hover:bg-base-200"
								>
									<span class="flex min-w-0 items-center gap-3">
										<input
											class="checkbox checkbox-sm checkbox-primary"
											type="checkbox"
											checked={optionSelected('categories', option)}
											onchange={() => toggleFilter('categories', option)}
										/>
										<span class="label-text truncate">{option}</span>
									</span>
									<span class="badge badge-ghost badge-sm">{optionCount('categories', option)}</span
									>
								</label>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<div class="w-full">
				<button
					bind:this={themeButton}
					class="btn w-full justify-between btn-outline"
					type="button"
					aria-expanded={openFilter === 'themes'}
					onclick={() => toggleDropdown('themes')}
				>
					Theme
					<span class="badge badge-primary">{themes.length || availableThemes.length}</span>
				</button>
				{#if openFilter === 'themes'}
					<div
						bind:this={themeMenu}
						class="z-50 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl"
						style={themeMenuStyle}
						role="menu"
					>
						<input
							class="input-bordered input input-sm mb-2 w-full"
							type="search"
							bind:value={themeOptionSearch}
							placeholder="Search themes"
							aria-label="Search themes"
						/>
						<div class="max-h-64 overflow-y-auto">
							{#each visibleThemes as option}
								<label
									class="label flex cursor-pointer justify-between gap-3 rounded-lg px-2 hover:bg-base-200"
								>
									<span class="flex min-w-0 items-center gap-3">
										<input
											class="checkbox checkbox-sm checkbox-primary"
											type="checkbox"
											checked={optionSelected('themes', option)}
											onchange={() => toggleFilter('themes', option)}
										/>
										<span class="label-text truncate">{option}</span>
									</span>
									<span class="badge badge-ghost badge-sm">{optionCount('themes', option)}</span>
								</label>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
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
