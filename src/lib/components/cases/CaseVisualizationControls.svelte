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
	class="flex flex-wrap items-center justify-start gap-2 lg:justify-end"
	aria-label="Visualization preferences"
>
	<div
		class="inline-flex rounded-md border border-slate-200 bg-white p-0.5 shadow-xs"
		aria-label="Filter placement"
	>
		<button
			class={filterLayout === 'top'
				? 'rounded-sm bg-slate-950 px-3 py-1.5 text-sm font-medium text-white transition'
				: 'rounded-sm px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100'}
			type="button"
			title="Show filters above results"
			onclick={() => onFilterLayoutChange('top')}
		>
			Top
		</button>
		<button
			class={filterLayout === 'left'
				? 'rounded-sm bg-slate-950 px-3 py-1.5 text-sm font-medium text-white transition'
				: 'rounded-sm px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100'}
			type="button"
			title="Show filters in left column"
			onclick={() => onFilterLayoutChange('left')}
		>
			Left
		</button>
	</div>
	<div
		class="inline-flex rounded-md border border-slate-200 bg-white p-0.5 shadow-xs"
		aria-label="Case result view"
	>
		<button
			class={viewMode === 'cards'
				? 'rounded-sm bg-slate-950 px-3 py-1.5 text-sm font-medium text-white transition'
				: 'rounded-sm px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100'}
			type="button"
			onclick={() => onViewModeChange('cards')}
		>
			Cards
		</button>
		<button
			class={viewMode === 'table'
				? 'rounded-sm bg-slate-950 px-3 py-1.5 text-sm font-medium text-white transition'
				: 'rounded-sm px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100'}
			type="button"
			onclick={() => onViewModeChange('table')}
		>
			Table
		</button>
	</div>
</div>
