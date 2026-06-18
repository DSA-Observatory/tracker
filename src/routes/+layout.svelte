<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import Header from '$lib/components/ui/Header.svelte';

	let { children } = $props();
	let showHeaderSearch = $derived(page.route.id !== '/cases');
</script>

<Header showSearch={showHeaderSearch} />

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
