<script lang="ts">
	import AdminPanelLayout from '$lib/components/admin/AdminPanelLayout.svelte';
	import CasesTable from '$lib/components/CasesTable.svelte';
	import { authStore } from '$lib/database';
</script>

<svelte:head>
	<title>Draft Cases | DSA Case Law Tracker</title>
	<meta name="description" content="Review unpublished DSA case records." />
</svelte:head>

<AdminPanelLayout>
	{#if !authStore.isAuthenticated}
		<div class="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
			Sign in to review draft cases.
		</div>
	{:else if !authStore.isAdmin}
		<div class="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
			This page is only available to administrators.
		</div>
	{:else}
		<div class="min-h-[38rem] rounded-[2rem] border border-slate-200 bg-white py-5 shadow-sm">
			<CasesTable
				publicationFilter="draft"
				heading="Draft cases"
				description="Review active unpublished records before publication."
			/>
		</div>
	{/if}
</AdminPanelLayout>
