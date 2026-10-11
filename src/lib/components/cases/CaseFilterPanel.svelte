<script lang="ts">
	import FilterMenu, { type FilterOption } from '$lib/components/FilterMenu.svelte';
	import type { ActiveFilterChip, FilterGroup } from './types';

	let {
		sidebar,
		filteredCount,
		totalCount,
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
		activeTab = 'browse',
		savedCount = 0,
		onTabChange = () => {},
		onToggle,
		onClear
	}: {
		sidebar: boolean;
		filteredCount: number;
		totalCount: number;
		search: string;
		activeChips: ActiveFilterChip[];
		countryFilterOptions: FilterOption[];
		categoryFilterOptions: FilterOption[];
		articleFilterOptions: FilterOption[];
		courtFilterOptions: FilterOption[];
		yearFilterOptions: FilterOption[];
		countries: string[];
		categories: string[];
		articles: string[];
		courts: string[];
		years: string[];
		activeTab?: 'browse' | 'saved';
		savedCount?: number;
		onTabChange?: (tab: 'browse' | 'saved') => void;
		onToggle: (group: FilterGroup, value: string) => void;
		onClear: () => void;
	} = $props();
</script>

<div
	data-case-filters
	class={`max-w-full min-w-0 ${sidebar ? 'h-full overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm shadow-slate-200/60' : 'pt-3'}`}
>
	<div
		class={sidebar
			? 'mb-3 flex items-start justify-between gap-3'
			: 'mb-2 flex flex-wrap items-center justify-between gap-2'}
	>
		<div class="min-w-0">
			<p class="text-xl leading-tight font-bold tracking-tight text-slate-950">Filters</p>
			<p class="mt-0.5 text-xs text-slate-500">
				{#if activeChips.length > 0 || search}
					Showing {filteredCount} of {totalCount} cases
				{:else}
					{totalCount} cases available
				{/if}
			</p>
		</div>

		<button
			class="inline-flex h-8 shrink-0 items-center rounded-md bg-slate-950 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-default disabled:bg-transparent disabled:text-slate-500 disabled:opacity-40 disabled:hover:bg-transparent"
			type="button"
			onclick={onClear}
			disabled={activeChips.length === 0 && !search}
		>
			Clear all
		</button>
	</div>

	<div class="mb-3 grid grid-cols-2 rounded-lg border border-slate-200 bg-white p-1 text-sm">
		<button
			class={activeTab === 'browse'
				? 'rounded-md bg-slate-200 px-2 py-1.5 font-semibold text-slate-700'
				: 'rounded-md px-2 py-1.5 font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-950'}
			type="button"
			aria-pressed={activeTab === 'browse'}
			onclick={() => onTabChange('browse')}>Browse</button
		>
		<button
			class={savedCount > 0
				? 'rounded-md bg-primary px-2 py-1.5 font-semibold text-primary-content hover:bg-primary/90'
				: activeTab === 'saved'
					? 'rounded-md bg-slate-200 px-2 py-1.5 font-semibold text-slate-700'
					: 'rounded-md px-2 py-1.5 font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-950'}
			type="button"
			aria-pressed={activeTab === 'saved'}
			onclick={() => onTabChange('saved')}
			>Saved {#if savedCount > 0}<span class="text-xs opacity-70">{savedCount}</span>{/if}</button
		>
	</div>

	<div
		class={sidebar
			? 'grid min-w-0 gap-3'
			: 'grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))]'}
	>
		<FilterMenu
			label="Country"
			icon="country"
			variant={sidebar ? 'collapsible' : 'dropdown'}
			options={countryFilterOptions}
			selected={countries}
			placeholder="Search countries"
			onToggle={(value) => onToggle('countries', value)}
		/>
		<FilterMenu
			label="Category"
			icon="category"
			variant={sidebar ? 'collapsible' : 'dropdown'}
			options={categoryFilterOptions}
			selected={categories}
			placeholder="Search categories"
			onToggle={(value) => onToggle('categories', value)}
		/>
		<FilterMenu
			label="DSA provisions"
			icon="articles"
			variant={sidebar ? 'collapsible' : 'dropdown'}
			options={articleFilterOptions}
			selected={articles}
			placeholder="Search DSA provisions"
			onToggle={(value) => onToggle('articles', value)}
		/>
		<FilterMenu
			label="Court"
			icon="court"
			variant={sidebar ? 'collapsible' : 'dropdown'}
			options={courtFilterOptions}
			selected={courts}
			placeholder="Search courts"
			onToggle={(value) => onToggle('courts', value)}
		/>
		<FilterMenu
			label="Decision year"
			icon="year"
			variant={sidebar ? 'collapsible' : 'dropdown'}
			options={yearFilterOptions}
			selected={years}
			placeholder="Search years"
			onToggle={(value) => onToggle('years', value)}
		/>
	</div>
</div>
