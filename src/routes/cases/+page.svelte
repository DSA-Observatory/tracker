<script lang="ts">
	import CasesTable from '$lib/components/CasesTable.svelte';
</script>

<svelte:head>
	<title>Case Database | DSA Case Law Tracker</title>
	<meta
		name="description"
		content="Search, filter, and maintain DSA private enforcement case records."
	/>
</svelte:head>

<main class="overflow-hidden">
	<CasesTable />
</main>
