<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import Header from '$lib/components/ui/Header.svelte';
	import SideMenu from '$lib/components/ui/SideMenu.svelte';
	import Footer from '$lib/components/ui/Footer.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="site-shell">
	<Header />
	<SideMenu />
	<div class="site-content">{@render children?.()}</div>
	<Footer />
</div>

<style>
	.site-shell { min-height: 100dvh; display: flex; flex-direction: column; }
	.site-content { flex: 1; min-width: 0; }
</style>
