<script lang="ts">
	import { page } from '$app/state';
	import CaseEditorForm from '$lib/components/cases/CaseEditorForm.svelte';
</script>

<svelte:head>
	<title>Edit Case | DSA Case Law Tracker</title>
	<meta name="description" content="Edit a DSA private enforcement case record." />
</svelte:head>

<CaseEditorForm caseId={page.params.id} />
