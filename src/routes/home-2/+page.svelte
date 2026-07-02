<script lang="ts">
	import { page } from '$app/state';
	import CasesTable from '$lib/components/CasesTable.svelte';

	const mapStartsCollapsed = $derived(page.url.searchParams.get('map') !== 'expanded');
</script>

<svelte:head>
	<title>Home 2 | DSA Case Law Tracker</title>
	<meta
		name="description"
		content="Demo home layout showing the DSA case tracker directly with a collapsible map."
	/>
	<style>
		@media (min-width: 768px) {
			html,
			body {
				overflow: hidden;
			}
		}
	</style>
</svelte:head>

<main
	class="-mt-4 min-h-[calc(100dvh-4rem)] overflow-visible bg-slate-50/80 sm:-mt-10 md:h-[calc(100dvh-4rem)] md:overflow-hidden"
>
	<CasesTable showMap={true} {mapStartsCollapsed} />
</main>
