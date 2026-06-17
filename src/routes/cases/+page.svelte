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

<main class="h-[calc(100dvh-7rem)] overflow-hidden">
	<CasesTable />
</main>
