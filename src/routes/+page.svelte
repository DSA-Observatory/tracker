<script lang="ts">
	import { resolve } from '$app/paths';

	const highlights = [
		{
			title: 'Structured case pages',
			description:
				'Each entry combines core metadata, editorial context, source links, and related references.'
		},
		{
			title: 'Searchable public resource',
			description:
				'The tracker is designed to support browsing by jurisdiction, legal theme, status, and DSA article.'
		},
		{
			title: 'Built for growth',
			description:
				'The tracker connects editorial case work with durable research infrastructure for the DSA community.'
		}
	] as const;
</script>

<svelte:head>
	<title>DSA Case Law Tracker</title>
	<meta
		name="description"
		content="A public, open-access tracker for private enforcement cases under the EU Digital Services Act."
	/>
</svelte:head>

<main class="overflow-hidden">
	<section class="container mx-auto max-w-6xl px-4 pt-6 pb-16">
		<div>
			<p class="mb-4 text-sm font-semibold tracking-[0.3em] text-primary uppercase">
				Private enforcement of the Digital Services Act
			</p>
			<h1 class="max-w-4xl text-4xl leading-tight font-black sm:text-6xl">
				A public case law tracker for DSA litigation across EU Member States.
			</h1>
			<p class="mt-6 max-w-3xl text-lg leading-8 text-base-content/75">
				The DSA Case Law Tracker is a public resource for IViR, the University of Amsterdam, and the
				DSA Observatory. It helps researchers collect, structure, review, and publish private
				enforcement cases while keeping the public site searchable, filterable, and easy to cite.
			</p>
			<div class="mt-8 flex flex-wrap gap-3">
				<a class="btn btn-primary" href={resolve('/cases')}>Open case database</a>
				<a class="btn btn-outline" href={resolve('/about')}>Learn more</a>
			</div>
		</div>

		<div class="mt-10 grid gap-4 md:grid-cols-3">
			{#each highlights as highlight}
				<article class="rounded-[2rem] border border-base-300/60 bg-base-200/70 p-5 backdrop-blur">
					<h2 class="text-xl font-black text-primary">{highlight.title}</h2>
					<p class="mt-3 leading-7 text-base-content/75">{highlight.description}</p>
				</article>
			{/each}
		</div>
	</section>

	<section class="border-y border-base-300/50 bg-base-200/40">
		<div class="container mx-auto grid max-w-6xl gap-6 px-4 py-12 md:grid-cols-3">
			<div>
				<p class="text-sm font-semibold tracking-[0.25em] text-primary uppercase">Audience</p>
				<p class="mt-3 text-base-content/75">
					Researchers, civil society, policymakers, litigation funders, legal professionals, and
					journalists.
				</p>
			</div>
			<div>
				<p class="text-sm font-semibold tracking-[0.25em] text-primary uppercase">Sources</p>
				<p class="mt-3 text-base-content/75">
					Rechtspraak.nl, CURIA, national case law databases, public documents, expert tips, and
					community submissions.
				</p>
			</div>
			<div>
				<p class="text-sm font-semibold tracking-[0.25em] text-primary uppercase">Inspiration</p>
				<p class="mt-3 text-base-content/75">
					Climate Case Chart, Tech Justice Law Project, DSA Observatory, WILMap, and other public
					legal trackers.
				</p>
			</div>
		</div>
	</section>
</main>
