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
		html,
		body {
			overflow: hidden;
		}
	</style>
</svelte:head>

<main class="h-[calc(100dvh-4rem)] -mt-10 overflow-hidden bg-slate-50/80">
	<CasesTable />
</main>
