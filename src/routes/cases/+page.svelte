<script lang="ts">
	import CasesTable from '$lib/components/CasesTable.svelte';
</script>

<svelte:head>
	<title>Case Database | DSA Case Law Tracker</title>
	<meta
		name="description"
		content="Search, filter, and maintain DSA private enforcement case records."
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
	<CasesTable />
</main>
