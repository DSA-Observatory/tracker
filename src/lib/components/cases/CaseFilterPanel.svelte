<script lang="ts">
	import FilterMenu, { type FilterOption } from '$lib/components/FilterMenu.svelte';
	import type { ActiveFilterChip, FilterGroup, ViewMode } from './types';

	let {
		sidebar,
		filteredCount,
		totalCount,
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
		onToggle,
		onClear
	}: {
		sidebar: boolean;
		filteredCount: number;
		totalCount: number;
		viewMode: ViewMode;
		search: string;
		activeChips: ActiveFilterChip[];
		statusFilterOptions: FilterOption[];
		countryFilterOptions: FilterOption[];
		categoryFilterOptions: FilterOption[];
		themeFilterOptions: FilterOption[];
		articleFilterOptions: FilterOption[];
		courtFilterOptions: FilterOption[];
		partyFilterOptions: FilterOption[];
		yearFilterOptions: FilterOption[];
		statuses: string[];
		countries: string[];
		categories: string[];
		themes: string[];
		articles: string[];
		courts: string[];
		parties: string[];
		years: string[];
		onToggle: (group: FilterGroup, value: string) => void;
		onClear: () => void;
	} = $props();
</script>

<div
	class={`max-w-full min-w-0 ${sidebar ? 'h-full overflow-auto rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm shadow-slate-200/60' : 'pt-3'}`}
>
	<div class={sidebar ? 'mb-3' : 'mb-2 flex flex-wrap items-center justify-between gap-2'}>
		<p class="text-xs font-medium tracking-[0.18em] text-slate-400 uppercase">Filters</p>
		<p class="text-sm text-slate-500">
			Showing <span class="font-medium text-slate-900">{filteredCount}</span> of {totalCount} cases in
			{viewMode} view
		</p>
	</div>

	<div
		class={sidebar
			? 'grid min-w-0 gap-3'
			: 'grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))]'}
	>
		<FilterMenu
			label="Status"
			options={statusFilterOptions}
			selected={statuses}
			placeholder="Search statuses"
			onToggle={(value) => onToggle('statuses', value)}
		/>
		<FilterMenu
			label="Country"
			options={countryFilterOptions}
			selected={countries}
			placeholder="Search countries"
			onToggle={(value) => onToggle('countries', value)}
		/>
		<FilterMenu
			label="Category"
			options={categoryFilterOptions}
			selected={categories}
			placeholder="Search categories"
			onToggle={(value) => onToggle('categories', value)}
		/>
		<FilterMenu
			label="Theme"
			options={themeFilterOptions}
			selected={themes}
			placeholder="Search themes"
			onToggle={(value) => onToggle('themes', value)}
		/>
		<FilterMenu
			label="DSA provisions"
			options={articleFilterOptions}
			selected={articles}
			placeholder="Search DSA provisions"
			onToggle={(value) => onToggle('articles', value)}
		/>
		<FilterMenu
			label="Court"
			options={courtFilterOptions}
			selected={courts}
			placeholder="Search courts"
			onToggle={(value) => onToggle('courts', value)}
		/>
		<FilterMenu
			label="Parties"
			options={partyFilterOptions}
			selected={parties}
			placeholder="Search plaintiffs or defendants"
			onToggle={(value) => onToggle('parties', value)}
		/>
		<FilterMenu
			label="Decision year"
			options={yearFilterOptions}
			selected={years}
			placeholder="Search years"
			onToggle={(value) => onToggle('years', value)}
		/>
	</div>

	{#if activeChips.length > 0 || search}
		<div class="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
			<button
				class="inline-flex h-7 items-center rounded-md px-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
				type="button"
				onclick={onClear}
			>
				Clear filters
			</button>
			{#each activeChips as chip}
				<button
					class="inline-flex h-7 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50"
					type="button"
					onclick={() => onToggle(chip.group, chip.value)}
				>
					{chip.label}
					<span aria-hidden="true">×</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
