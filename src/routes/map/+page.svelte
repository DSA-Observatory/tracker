<script lang="ts">
	import CaseJurisdictionMap from '$lib/components/cases/CaseJurisdictionMap.svelte';
</script>

<svelte:head>
	<title>Jurisdiction Map | DSA Case Law Tracker</title>
	<meta name="description" content="Browse DSA private enforcement cases by jurisdiction." />
</svelte:head>

<main class="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
	<div class="mb-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
		<p class="text-sm font-semibold tracking-[0.24em] text-primary uppercase">Geographic view</p>
		<h1 class="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
			Case distribution by jurisdiction
		</h1>
		<p class="mt-4 max-w-2xl text-slate-600">
			This MVP map view shows where published DSA private enforcement records are concentrated.
		</p>
	</div>

	<CaseJurisdictionMap />
</main>
