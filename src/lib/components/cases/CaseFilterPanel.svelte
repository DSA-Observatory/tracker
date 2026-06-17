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
	class={`max-w-full min-w-0 border border-base-300/70 bg-base-100/80 p-4 shadow-sm backdrop-blur-xl ${sidebar ? 'h-full overflow-auto' : ''}`}
>
	<div class="mb-3">
		<p class="text-xs font-semibold tracking-[0.2em] text-base-content/50 uppercase">
			Filter cases
		</p>
		<p class="text-sm text-base-content/70">
			Showing {filteredCount} of {totalCount} cases in {viewMode} view
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
		<div class="mt-4 flex flex-wrap gap-2">
			<button class="btn h-7 btn-ghost btn-xs" type="button" onclick={onClear}>
				Clear filters
			</button>
			{#each activeChips as chip}
				<button
					class="badge gap-2 badge-outline py-3"
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
