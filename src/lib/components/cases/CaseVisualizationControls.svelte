<script lang="ts">
	import type { FilterLayout, ViewMode } from './types';

	let {
		viewMode,
		filterLayout,
		onViewModeChange,
		onFilterLayoutChange
	}: {
		viewMode: ViewMode;
		filterLayout: FilterLayout;
		onViewModeChange: (mode: ViewMode) => void;
		onFilterLayoutChange: (layout: FilterLayout) => void;
	} = $props();
</script>

<div
	class="flex flex-wrap items-center justify-start gap-1.5 lg:justify-end"
	aria-label="Visualization preferences"
>
	<div
		class="hidden rounded-md border border-slate-200 bg-white/80 p-0.5 shadow-xs md:inline-flex"
		aria-label="Filter placement"
	>
		<button
			class={filterLayout === 'top'
				? 'rounded-sm bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-950 transition'
				: 'rounded-sm px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800'}
			type="button"
			title="Show filters above results"
			onclick={() => onFilterLayoutChange('top')}
		>
			Top
		</button>
		<button
			class={filterLayout === 'left'
				? 'rounded-sm bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-950 transition'
				: 'rounded-sm px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800'}
			type="button"
			title="Show filters in left column"
			onclick={() => onFilterLayoutChange('left')}
		>
			Left
		</button>
	</div>
	<div
		class="inline-flex rounded-md border border-slate-200 bg-white/80 p-0.5 shadow-xs"
		aria-label="Case result view"
	>
		<button
			class={viewMode === 'cards'
				? 'rounded-sm bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-950 transition'
				: 'rounded-sm px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800'}
			type="button"
			onclick={() => onViewModeChange('cards')}
		>
			Cards
		</button>
		<button
			class={viewMode === 'table'
				? 'rounded-sm bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-950 transition'
				: 'rounded-sm px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800'}
			type="button"
			onclick={() => onViewModeChange('table')}
		>
			Table
		</button>
	</div>
</div>
