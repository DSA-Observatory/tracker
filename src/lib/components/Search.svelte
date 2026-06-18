<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import type { SearchScope } from '$lib/components/cases/types';
	import { pb, type CaseRecord } from '$lib/database';
	import { caseSearchQuery } from '$lib/stores/case-search.store';

	interface SearchScopeOption {
		value: SearchScope;
		label: string;
	}

	interface Props {
		value?: string;
		searchScope?: SearchScope;
		scopes?: SearchScopeOption[];
		placeholder?: string;
		navigateOnSubmit?: boolean;
		showSuggestions?: boolean;
		variant?: 'header' | 'hero';
	}

	let {
		value = $bindable(''),
		searchScope = $bindable<SearchScope>('all'),
		scopes = [],
		placeholder = 'Search cases',
		navigateOnSubmit = true,
		showSuggestions = navigateOnSubmit,
		variant = 'header'
	}: Props = $props();
	let cases = $state<CaseRecord[]>([]);
	let suggestionsOpen = $state(false);
	let suggestionsLoading = $state(false);
	let suggestionsError = $state(false);
	let activeSuggestionIndex = $state(0);
	let searchForm = $state<HTMLFormElement>();
	let syncedSearchValue = '';
	let suggestions = $derived(buildSuggestions());
	let suggestionActionCount = $derived(suggestions.length + 1);

	$effect(() => {
		if (value === syncedSearchValue) return;

		syncedSearchValue = value;
		caseSearchQuery.set(value);
	});

	$effect(() => {
		value;
		suggestions.length;
		activeSuggestionIndex = 0;
	});

	function normalize(value?: string) {
		return (value ?? '').toLowerCase().trim();
	}

	function searchableText(record: CaseRecord) {
		return [
			record.title,
			record.case_id,
			record.ecli,
			record.court,
			record.jurisdiction,
			...(record.plaintiffs ?? []),
			...(record.defendants ?? []),
			...(record.dsa_articles ?? []),
			...(record.categories ?? []),
			...(record.themes ?? [])
		]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();
	}

	function buildSuggestions() {
		const query = normalize(value);
		if (!showSuggestions) return [];
		if (!query) return cases.slice(0, 5);
		if (query.length < 2) return [];

		return cases
			.filter((record) => searchableText(record).includes(query))
			.sort((a, b) => suggestionRank(a, query) - suggestionRank(b, query))
			.slice(0, 5);
	}

	function suggestionRank(record: CaseRecord, query: string) {
		const title = normalize(record.title);
		const caseId = normalize(record.case_id);

		if (title.startsWith(query)) return 0;
		if (caseId.startsWith(query)) return 1;
		if (title.includes(query)) return 2;
		return 3;
	}

	async function loadSuggestions() {
		if (!showSuggestions || cases.length || suggestionsLoading) return;

		suggestionsLoading = true;
		suggestionsError = false;

		try {
			cases = await pb.collection('cases').getFullList<CaseRecord>({
				sort: '-decision_date,-created'
			});
		} catch (err) {
			console.error('Error loading search suggestions:', err);
			suggestionsError = true;
		} finally {
			suggestionsLoading = false;
		}
	}

	function submitSearch() {
		const query = value.trim();
		if (!query || !navigateOnSubmit) return;

		suggestionsOpen = false;
		goto(`${base}/cases?q=${encodeURIComponent(query)}`);
	}

	function openSuggestion(record: CaseRecord) {
		value = record.title;
		suggestionsOpen = false;
		goto(`${base}/cases?q=${encodeURIComponent(record.title)}`);
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (!showSuggestions || !navigateOnSubmit) return;

		if (event.key === 'Escape') {
			suggestionsOpen = false;
			return;
		}

		if (suggestionsLoading || suggestionsError) return;

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			suggestionsOpen = true;
			activeSuggestionIndex = (activeSuggestionIndex + 1) % suggestionActionCount;
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			suggestionsOpen = true;
			activeSuggestionIndex =
				(activeSuggestionIndex - 1 + suggestionActionCount) % suggestionActionCount;
			return;
		}

		if (event.key === 'Enter' && suggestionsOpen) {
			event.preventDefault();

			const record = suggestions[activeSuggestionIndex];
			if (record) {
				openSuggestion(record);
			} else {
				submitSearch();
			}
		}
	}

	onMount(() => {
		loadSuggestions();
		const unsubscribeSearch = caseSearchQuery.subscribe((nextValue) => {
			syncedSearchValue = nextValue;
			if (value !== nextValue) value = nextValue;
		});

		function closeOnOutsideClick(event: PointerEvent) {
			if (!searchForm?.contains(event.target as Node)) suggestionsOpen = false;
		}

		document.addEventListener('pointerdown', closeOnOutsideClick);
		return () => {
			unsubscribeSearch();
			document.removeEventListener('pointerdown', closeOnOutsideClick);
		};
	});
</script>

<form
	bind:this={searchForm}
	class={variant === 'hero'
		? 'rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm shadow-slate-200/60 backdrop-blur'
		: 'relative'}
	onsubmit={(event) => {
		event.preventDefault();
		submitSearch();
	}}
>
	<div class={variant === 'hero' ? 'grid gap-2 lg:grid-cols-[minmax(20rem,1fr)_13rem]' : ''}>
		<label
			class={variant === 'hero'
				? 'flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-xs transition focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-950/10'
				: 'input-bordered input flex items-center gap-2 opacity-80'}
		>
			{#if variant === 'hero'}
				<span class="text-slate-400" aria-hidden="true">Search</span>
			{:else}
				<svg class="h-5 w-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
			{/if}
			<input
				type="search"
				{placeholder}
				class={variant === 'hero'
					? 'min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-950 placeholder:text-slate-400 focus:outline-none'
					: 'grow'}
				aria-label="Search cases"
				bind:value
				onfocus={() => {
					suggestionsOpen = true;
					loadSuggestions();
				}}
				oninput={() => {
					suggestionsOpen = true;
					activeSuggestionIndex = 0;
				}}
				onkeydown={handleSearchKeydown}
			/>
			{#if navigateOnSubmit}
				<button class="badge hidden badge-primary sm:inline-flex" type="submit">Go</button>
			{/if}
		</label>

		{#if scopes.length}
			<label
				class="flex h-10 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-xs transition focus-within:ring-2 focus-within:ring-slate-950/10 hover:bg-slate-50"
			>
				<span class="shrink-0 text-slate-400">Search in</span>
				<select
					class="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-700 outline-none"
					bind:value={searchScope}
					aria-label="Search scope"
				>
					{#each scopes as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</label>
		{/if}
	</div>

	{#if showSuggestions && navigateOnSubmit && suggestionsOpen}
		<div
			class="absolute top-[calc(100%+0.5rem)] right-0 left-0 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-950/10"
		>
			{#if suggestionsLoading}
				<p class="px-3 py-2 text-sm text-slate-500">Searching cases...</p>
			{:else if suggestionsError}
				<p class="px-3 py-2 text-sm text-slate-500">Suggestions unavailable.</p>
			{:else if suggestions.length > 0}
				<div class="py-1">
					{#each suggestions as record, index (record.id)}
						{@const isActive = activeSuggestionIndex === index}
						<button
							class={isActive
								? 'block w-full bg-primary px-3 py-2 text-left text-primary-content transition focus:outline-none'
								: 'block w-full px-3 py-2 text-left transition hover:bg-primary/10 focus:bg-primary/10 focus:outline-none'}
							type="button"
							onmouseenter={() => (activeSuggestionIndex = index)}
							onmousedown={(event) => event.preventDefault()}
							onclick={() => openSuggestion(record)}
						>
							<span class="block truncate text-sm font-semibold">{record.title}</span>
							<span
								class={isActive
									? 'mt-0.5 block truncate text-xs text-primary-content/80'
									: 'mt-0.5 block truncate text-xs text-slate-500'}
							>
								{[record.jurisdiction, record.court, record.case_id].filter(Boolean).join(' / ')}
							</span>
						</button>
					{/each}
				</div>
				{@const isSearchAllActive = activeSuggestionIndex === suggestions.length}
				<button
					class={isSearchAllActive
						? 'block w-full border-t border-primary/30 bg-primary px-3 py-2 text-left text-sm font-medium text-primary-content transition focus:outline-none'
						: 'block w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-primary/10 focus:bg-primary/10 focus:outline-none'}
					type="submit"
					onmouseenter={() => (activeSuggestionIndex = suggestions.length)}
				>
					Search all cases for "{value.trim()}"
				</button>
			{:else}
				<button
					class="block w-full bg-primary px-3 py-2 text-left text-sm font-medium text-primary-content transition focus:outline-none"
					type="submit"
				>
					Search all cases for "{value.trim()}"
				</button>
			{/if}
		</div>
	{/if}
</form>
