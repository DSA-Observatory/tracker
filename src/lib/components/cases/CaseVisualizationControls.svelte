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
	<div class="join" aria-label="Filter placement">
		<button
			class="btn join-item btn-sm"
			class:btn-primary={filterLayout === 'top'}
			class:btn-ghost={filterLayout !== 'top'}
			type="button"
			title="Show filters above results"
			onclick={() => onFilterLayoutChange('top')}
		>
			<span aria-hidden="true">▤</span>
			Top
		</button>
		<button
			class="btn join-item btn-sm"
			class:btn-primary={filterLayout === 'left'}
			class:btn-ghost={filterLayout !== 'left'}
			type="button"
			title="Show filters in left column"
			onclick={() => onFilterLayoutChange('left')}
		>
			<span aria-hidden="true">◨</span>
			Left
		</button>
	</div>
	<div class="join" aria-label="Case result view">
		<button
			class="btn join-item btn-sm"
			class:btn-primary={viewMode === 'cards'}
			class:btn-ghost={viewMode !== 'cards'}
			type="button"
			onclick={() => onViewModeChange('cards')}
		>
			<span aria-hidden="true">▦</span>
			Cards
		</button>
		<button
			class="btn join-item btn-sm"
			class:btn-primary={viewMode === 'table'}
			class:btn-ghost={viewMode !== 'table'}
			type="button"
			onclick={() => onViewModeChange('table')}
		>
			<span aria-hidden="true">≡</span>
			Table
		</button>
	</div>
</div>
