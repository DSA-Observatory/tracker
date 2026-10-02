<script lang="ts">
	import PolicyLayout from '$lib/components/ui/PolicyLayout.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<title>Policy | DSA Case Law Tracker</title>
	<meta name="description" content="Use and editorial policy for the DSA Case Law Tracker." />
</svelte:head>

<PolicyLayout>{@render children?.()}</PolicyLayout>
