<script lang="ts">
	import { resolve } from '$app/paths';
	import EuropeanCaseNetwork from '$lib/components/cases/EuropeanCaseNetwork.svelte';

	function reveal(node: HTMLElement, delay = 0) {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		node.style.setProperty('--entry-delay', `${delay}ms`);
		node.classList.add('reveal-ready');
		const observer = new IntersectionObserver(([entry]) => {
			if (entry.isIntersecting) {
				node.classList.add('reveal-visible');
				observer.disconnect();
			}
		}, { threshold: 0.1 });
		observer.observe(node);
		return { destroy: () => observer.disconnect() };
	}

	const highlights = [
		{
			title: 'Case documentation',
			description:
				'Entries include case metadata, editorial summaries, source links, and related legal references.'
		},
		{
			title: 'Search and classification',
			description:
				'Cases can be browsed by jurisdiction, category, procedural status, and DSA article.'
		},
		{
			title: 'Research scope',
			description:
				'The database focuses on private enforcement of the DSA before courts in EU Member States.'
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
	<section class="landing-hero">
		<div class="hero-atlas"><EuropeanCaseNetwork /></div>
		<div class="hero-inner">
			<div class="hero-copy">
				<p class="hero-eyebrow">The DSA Case Law Tracker</p>
				<h1><span class="headline-line"><span>DSA litigation</span></span><span class="headline-line"><span>across Europe.</span></span></h1>
				<p class="hero-description">A public database of private enforcement cases under the EU Digital Services Act, with case summaries, legal references, and source documents.</p>
				<div class="hero-actions">
					<a class="btn btn-primary" href={resolve('/cases')}>Browse cases <span aria-hidden="true">↗</span></a>
					<a class="hero-about" href={resolve('/about')}>About the project <span aria-hidden="true">→</span></a>
				</div>
				<a class="hero-map-link" href={resolve('/map')}>View cases by jurisdiction <span aria-hidden="true">↗</span></a>
			</div>
			<div class="hero-footnote"><span>IViR · University of Amsterdam · DSA Observatory</span></div>
		</div>
	</section>
	<section class="container mx-auto max-w-6xl px-4 py-12">
		<div class="grid gap-8 md:grid-cols-3">
			{#each highlights as highlight, index}
				<article use:reveal={index * 120} class="border-t border-base-300 pt-5">
					<h2 class="text-lg font-bold">{highlight.title}</h2>
					<p class="mt-3 leading-7 text-base-content/75">{highlight.description}</p>
				</article>
			{/each}
		</div>
	</section>

	<section class="border-y border-base-300/50 bg-base-200/40">
		<div class="container mx-auto grid max-w-6xl gap-6 px-4 py-12 md:grid-cols-3">
			<div use:reveal>
				<p class="text-sm font-semibold tracking-[0.25em] text-primary uppercase">Audience</p>
				<p class="mt-3 text-base-content/75">
					Researchers, civil society, policymakers, litigation funders, legal professionals, and
					journalists.
				</p>
			</div>
			<div use:reveal={120}>
				<p class="text-sm font-semibold tracking-[0.25em] text-primary uppercase">Sources</p>
				<p class="mt-3 text-base-content/75">
					Rechtspraak.nl, CURIA, national case law databases, public documents, expert tips, and
					community submissions.
				</p>
			</div>
			<div use:reveal={240}>
				<p class="text-sm font-semibold tracking-[0.25em] text-primary uppercase">Inspiration</p>
				<p class="mt-3 text-base-content/75">
					Climate Case Chart, Tech Justice Law Project, DSA Observatory, WILMap, and other public
					legal trackers.
				</p>
			</div>
		</div>
	</section>
</main>

<style>
	.landing-hero { position: relative; isolation: isolate; min-height: min(850px, calc(100svh - 65px)); }
	.hero-inner { position: relative; max-width: 1440px; margin: auto; padding: clamp(5rem, 9vw, 9rem) clamp(1.5rem, 6vw, 6rem) 2rem; pointer-events: none; }
	.hero-copy { position: relative; width: 58%; pointer-events: auto; }
	.hero-eyebrow { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .25em; margin-bottom: 2rem; }
	h1 { font-size: clamp(3.6rem, 6.4vw, 6.3rem); line-height: 1.02; letter-spacing: -.065em; font-weight: 850; }
	.headline-line { display: block; overflow: hidden; padding-bottom: .12em; margin-bottom: -.12em; }
	.headline-line > span { display: block; }
	.headline-muted { color: color-mix(in oklab, var(--color-base-content) 48%, var(--color-base-100)); }
	.hero-description { max-width: 23rem; margin-top: 2rem; font-size: 1.05rem; line-height: 1.75; color: color-mix(in oklab, var(--color-base-content) 65%, transparent); }
	.hero-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 1.6rem; margin-top: 2rem; }
	.hero-actions .btn { height: 3.25rem; padding-inline: 1.4rem; gap: 1.5rem; }
	.hero-about { font-size: .85rem; font-weight: 600; }
	.hero-about:hover { text-decoration: underline; }
	.hero-about span { margin-left: .5rem; }
	.hero-atlas { position: absolute; width: min(64vw, 1050px); height: 100%; right: max(-2%, calc((100% - 1440px) / 2 - 12rem)); top: -8rem; }
	.hero-map-link { display: inline-block; margin-top: 1.25rem; font-size: .8rem; color: color-mix(in oklab, var(--color-base-content) 65%, transparent); }
	.hero-map-link:hover { text-decoration: underline; }
	.hero-footnote { display: flex; justify-content: space-between; gap: 1rem; margin-top: 6rem; padding-top: 1.25rem; font-size: .68rem; letter-spacing: .035em; color: color-mix(in oklab, var(--color-base-content) 55%, transparent); }
	.hero-footnote a { pointer-events: auto; }
	@media (prefers-reduced-motion: no-preference) {
		.hero-eyebrow { animation: entry-rise .8s .1s both; }
		.headline-line > span { animation: headline-entry 1.15s cubic-bezier(.16, 1, .3, 1) both; }
		.headline-line:nth-child(1) > span { animation-delay: .2s; }
		.headline-line:nth-child(2) > span { animation-delay: .34s; }
		.headline-line:nth-child(3) > span { animation-delay: .48s; }
		.hero-description { animation: entry-rise 1s .65s both; }
		.hero-actions > :first-child { animation: entry-rise .9s .8s both; }
		.hero-actions > :last-child { animation: entry-rise .9s .92s both; }
		.hero-map-link { animation: entry-rise .9s 1s both; }
		.hero-footnote { animation: entry-rise 1s 1.1s both; }
		.hero-atlas { animation: atlas-entry 1.8s cubic-bezier(.16, 1, .3, 1) both; }
		:global(.reveal-ready) { opacity: 0; transform: translateY(30px); }
		:global(.reveal-visible) { animation: entry-rise .9s var(--entry-delay, 0ms) cubic-bezier(.16, 1, .3, 1) both; }
	}
	@keyframes entry-rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
	@keyframes headline-entry { from { opacity: 0; transform: translateY(110%) rotate(2deg); } to { opacity: 1; transform: translateY(0) rotate(0); } }
	@keyframes atlas-entry { from { opacity: 0; transform: scale(1.08) translateY(24px); } to { transform: scale(1) translateY(0); } }
	@media (max-width: 900px) {
		.landing-hero { min-height: auto; }
		.hero-inner { padding-top: 4rem; }
		.hero-copy { width: 100%; }
		h1 { font-size: clamp(3.4rem, 8.5vw, 5rem); }
		.hero-atlas { top: 13rem; right: -25%; width: 95%; height: 38rem; opacity: .55; }
		.hero-description { max-width: 20rem; }
		.hero-footnote { margin-top: 18rem; flex-wrap: wrap; }
	}
	@media (max-width: 540px) {
		.hero-atlas { top: 26rem; right: -13%; width: 120%; height: 26rem; opacity: 1; }
		.hero-footnote { margin-top: 26rem; }
		.hero-description { max-width: 23rem; }
	}
</style>
