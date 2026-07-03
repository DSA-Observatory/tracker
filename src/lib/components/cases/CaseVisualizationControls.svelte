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

<details class="relative" aria-label="Visualization preferences">
	<summary
		class="inline-flex h-8 cursor-pointer list-none items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold whitespace-nowrap text-slate-800 shadow-xs transition hover:border-slate-400 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 focus-visible:outline-none"
	>
		View: {viewMode === 'cards' ? 'Cards' : 'Table'}
		<span class="text-[0.6rem] text-slate-500" aria-hidden="true">▼</span>
	</summary>
	<div
		class="absolute right-0 z-50 mt-1 w-48 rounded-md border border-slate-200 bg-white p-1 shadow-lg"
	>
		<p class="px-2 py-1 text-[0.65rem] font-semibold tracking-[0.16em] text-slate-400 uppercase">
			Results
		</p>
		<button
			class={viewMode === 'cards'
				? 'block w-full rounded bg-slate-100 px-2 py-1.5 text-left text-xs font-semibold text-slate-950'
				: 'block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50'}
			type="button"
			onclick={() => onViewModeChange('cards')}
		>
			Cards
		</button>
		<button
			class={viewMode === 'table'
				? 'block w-full rounded bg-slate-100 px-2 py-1.5 text-left text-xs font-semibold text-slate-950'
				: 'block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50'}
			type="button"
			onclick={() => onViewModeChange('table')}
		>
			Table
		</button>
		<p
			class="mt-1 border-t border-slate-100 px-2 pt-2 pb-1 text-[0.65rem] font-semibold tracking-[0.16em] text-slate-400 uppercase"
		>
			Filters
		</p>
		<button
			class={filterLayout === 'left'
				? 'block w-full rounded bg-slate-100 px-2 py-1.5 text-left text-xs font-semibold text-slate-950'
				: 'block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50'}
			type="button"
			onclick={() => onFilterLayoutChange('left')}
		>
			Left column
		</button>
		<button
			class={filterLayout === 'top'
				? 'block w-full rounded bg-slate-100 px-2 py-1.5 text-left text-xs font-semibold text-slate-950'
				: 'block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50'}
			type="button"
			onclick={() => onFilterLayoutChange('top')}
		>
			Top row
		</button>
	</div>
</details>
