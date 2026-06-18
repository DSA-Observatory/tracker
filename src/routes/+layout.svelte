<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Header from '$lib/components/ui/Header.svelte';
	import SideMenu from '$lib/components/ui/SideMenu.svelte';

	let { children } = $props();
</script>

<Header />
<SideMenu />

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
