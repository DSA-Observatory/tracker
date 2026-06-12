<script lang="ts">
	const coreFields = [
		'Case title / name',
		'ECLI number or comparable identifier',
		'Filing date and decision date(s)',
		'Status or outcome',
		'Court(s) and jurisdiction',
		'Plaintiff(s) and defendant(s)',
		'Editorial summary',
		'DSA articles, keywords, and legal themes',
		'Linked documents, commentary, citations, and cited-by references'
	] as const;

	const mvpFeatures = [
		'PocketBase admin interface for researchers to create, edit, review, and publish cases',
		'Structured case entry template with document uploads and DSA article references',
		'Public case listing with search and filters by jurisdiction, status, date range, and tags',
		'Case detail pages with metadata, summaries, source documents, and related references',
		'Community submission questionnaire with editorial review before publication',
		'Rechtspraak.nl RSS monitoring as a separate ingestion module'
	] as const;

	const roadmap = [
		{
			phase: 'MVP',
			window: 'Months 1-3',
			items: [
				'Case database',
				'Admin workflow',
				'Search and filters',
				'Case pages',
				'Submission form'
			]
		},
		{
			phase: 'Phase 2',
			window: 'Months 4-6',
			items: ['EU map', 'Timelines', 'Advanced filters', 'API', 'CSV/JSON export']
		},
		{
			phase: 'Phase 3',
			window: 'AI/NLP',
			items: ['Semantic search', 'Talk to the cases', 'Auto summaries', 'Citation graph']
		}
	] as const;

	const openDecisions = [
		'Bundle multiple decisions under one case or publish each decision as its own entry?',
		'Should the public scope be private enforcement only, or include public enforcement too?',
		'Which dates are authoritative for filtering: filing, decision, appeal, or all procedural moments?',
		'Which source documents can be published, linked, or requested from parties?',
		'Should analysis live in the tracker itself or in linked DSA Observatory blog/report outputs?'
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
	<section
		class="container mx-auto grid max-w-6xl gap-10 px-4 pt-6 pb-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center"
	>
		<div>
			<p class="mb-4 text-sm font-semibold tracking-[0.3em] text-primary uppercase">
				Private enforcement of the Digital Services Act
			</p>
			<h1 class="max-w-4xl text-4xl leading-tight font-black sm:text-6xl">
				A public case law tracker for DSA litigation across EU Member States.
			</h1>
			<p class="mt-6 max-w-3xl text-lg leading-8 text-base-content/75">
				The DSA Case Law Tracker is an exploratory prototype for IViR, the University of Amsterdam,
				and the DSA Observatory. It gives researchers a hands-on way to collect, structure, review,
				and publish private enforcement cases while keeping the public site searchable, filterable,
				and easy to cite.
			</p>
			<div class="mt-8 flex flex-wrap gap-3">
				<a class="btn btn-primary" href="#case-template">View case template</a>
				<a class="btn btn-outline" href="#roadmap">Development roadmap</a>
			</div>
		</div>

		<aside
			class="rounded-[2rem] border border-base-300/60 bg-base-200/70 p-6 shadow-2xl shadow-primary/10 backdrop-blur"
		>
			<p class="text-sm tracking-[0.25em] text-base-content/50 uppercase">Prototype focus</p>
			<div class="mt-5 grid gap-4">
				<div class="rounded-2xl bg-base-100 p-4">
					<p class="text-3xl font-black text-primary">EU</p>
					<p class="text-sm text-base-content/70">Private enforcement cases under the DSA</p>
				</div>
				<div class="rounded-2xl bg-base-100 p-4">
					<p class="text-3xl font-black text-secondary">€7k</p>
					<p class="text-sm text-base-content/70">IT/web development budget inside WP2</p>
				</div>
				<div class="rounded-2xl bg-base-100 p-4">
					<p class="text-3xl font-black text-accent">2026</p>
					<p class="text-sm text-base-content/70">
						Pilot year, with launch and evaluation milestones
					</p>
				</div>
			</div>
		</aside>
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

	<section id="case-template" class="container mx-auto max-w-6xl px-4 py-16">
		<div class="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
			<div>
				<p class="text-sm font-semibold tracking-[0.25em] text-primary uppercase">
					Case entry template
				</p>
				<h2 class="mt-3 text-3xl font-black">
					Structured enough for research, editable enough for the team.
				</h2>
				<p class="mt-4 text-base-content/75">
					Each case should work as a curated page with attached data, public documents, tags, and
					cross-links. The first version should feel closer to an editorial tracker than a large
					archive, because the initial case volume is expected to be small.
				</p>
			</div>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each coreFields as field}
					<div class="rounded-2xl border border-base-300/60 bg-base-100 p-4">
						<p class="font-semibold">{field}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="bg-base-200/40">
		<div class="container mx-auto max-w-6xl px-4 py-16">
			<p class="text-sm font-semibold tracking-[0.25em] text-primary uppercase">Prototype scope</p>
			<h2 class="mt-3 max-w-3xl text-3xl font-black">
				The MVP should deliver a complete editorial loop.
			</h2>
			<div class="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each mvpFeatures as feature}
					<div class="rounded-3xl bg-base-100 p-5 shadow-lg shadow-black/5">
						<p class="leading-7 text-base-content/80">{feature}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section id="roadmap" class="container mx-auto max-w-6xl px-4 py-16">
		<p class="text-sm font-semibold tracking-[0.25em] text-primary uppercase">Roadmap</p>
		<h2 class="mt-3 text-3xl font-black">
			Build the pilot first, then scale the research infrastructure.
		</h2>
		<div class="mt-8 grid gap-5 lg:grid-cols-3">
			{#each roadmap as phase}
				<article class="rounded-[2rem] border border-base-300/60 bg-base-100 p-6">
					<p class="text-sm tracking-[0.2em] text-base-content/50 uppercase">{phase.window}</p>
					<h3 class="mt-2 text-2xl font-black text-primary">{phase.phase}</h3>
					<ul class="mt-5 space-y-3">
						{#each phase.items as item}
							<li class="flex gap-3 text-base-content/75">
								<span class="mt-2 size-2 rounded-full bg-secondary"></span>
								<span>{item}</span>
							</li>
						{/each}
					</ul>
				</article>
			{/each}
		</div>
	</section>

	<section class="container mx-auto max-w-6xl px-4 pb-20">
		<div class="rounded-[2rem] bg-base-200 p-6 md:p-10">
			<p class="text-sm font-semibold tracking-[0.25em] text-primary uppercase">Open decisions</p>
			<h2 class="mt-3 text-3xl font-black">Questions to resolve before implementation hardens.</h2>
			<div class="mt-6 grid gap-3">
				{#each openDecisions as decision}
					<p class="rounded-2xl bg-base-100 p-4 text-base-content/80">{decision}</p>
				{/each}
			</div>
		</div>
	</section>
</main>
