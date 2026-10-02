<script lang="ts">
	import PolicyLayout from '$lib/components/ui/PolicyLayout.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Privacy | DSA Case Law Tracker</title>
	<meta name="description" content="Draft privacy information for the DSA Case Law Tracker." />
</svelte:head>

<PolicyLayout>{@render children?.()}</PolicyLayout>
