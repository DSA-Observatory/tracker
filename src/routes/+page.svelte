<script lang="ts">
	import { resolve } from '$app/paths';
	import EuropeanCaseNetwork from '$lib/components/cases/EuropeanCaseNetwork.svelte';

	let definitionOpen = $state(false);
	let definitionTrigger: HTMLButtonElement;
	let definitionWrapper: HTMLSpanElement;
	let pointerFocus = false;

	function dismissDefinition(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !definitionOpen) return;
		definitionOpen = false;
		definitionTrigger?.focus();
	}

	function dismissDefinitionOutside(event: PointerEvent) {
		if (!definitionWrapper?.contains(event.target as Node)) definitionOpen = false;
	}
</script>

<svelte:window onkeydown={dismissDefinition} onpointerdown={dismissDefinitionOutside} />

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
				<p class="hero-description">A public database of <span class="definition" bind:this={definitionWrapper} onmouseenter={() => (definitionOpen = true)} onmouseleave={() => (definitionOpen = false)}><button bind:this={definitionTrigger} type="button" class="definition-trigger" aria-expanded={definitionOpen} aria-describedby="private-enforcement-definition" onpointerdown={() => (pointerFocus = true)} onfocus={() => { if (!pointerFocus) definitionOpen = true; pointerFocus = false; }} onblur={() => (definitionOpen = false)} onclick={() => (definitionOpen = true)}>private enforcement</button><span id="private-enforcement-definition" class:open={definitionOpen} class="definition-popover" role="tooltip">Our case tracker is focused on private enforcement, which involves litigation between two private entities. Enforcement by government bodies is not included.</span></span> cases under the EU Digital Services Act, with case summaries, legal references, and source documents.</p>
				<div class="hero-actions">
					<a class="btn btn-primary text-base font-bold text-black" href={resolve('/cases')}>Browse cases <span aria-hidden="true">↗</span></a>
					<a class="hero-about" href={resolve('/about')}>About the project <span aria-hidden="true">→</span></a>
				</div>
				<a class="hero-map-link" href={`${resolve('/cases')}?view=map`}>View cases by jurisdiction <span aria-hidden="true">↗</span></a>
			</div>
		</div>
	</section>
</main>

<style>
	.landing-hero { position: relative; isolation: isolate; min-height: min(850px, calc(100svh - 65px)); }
	.hero-inner { position: relative; display: flex; flex-direction: column; min-height: inherit; max-width: 1440px; margin: auto; padding: clamp(5rem, 9vw, 9rem) clamp(1.5rem, 6vw, 6rem) 2rem; pointer-events: none; }
	.hero-copy { position: relative; width: 58%; pointer-events: none; }
	.hero-copy a, .definition { pointer-events: auto; }
	.hero-eyebrow { font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .25em; margin-bottom: 2rem; }
	h1 { font-size: clamp(3.6rem, 6.4vw, 6.3rem); line-height: 1.02; letter-spacing: -.065em; font-weight: 850; }
	.headline-line { display: block; overflow: hidden; padding-bottom: .12em; margin-bottom: -.12em; }
	.headline-line > span { display: block; }
	.headline-muted { color: color-mix(in oklab, var(--color-base-content) 48%, var(--color-base-100)); }
	.hero-description { position: relative; max-width: 30rem; margin-top: 2rem; font-size: clamp(1.15rem, 1.5vw, 1.35rem); line-height: 1.65; color: var(--color-base-content); }
	.definition { position: relative; display: inline-block; }
	.definition-trigger { padding: 0 .12em; border-radius: .15em; background: #fde76c; color: var(--color-base-content); font: inherit; cursor: help; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
	.definition-trigger:focus-visible { outline: 2px solid var(--color-base-content); outline-offset: 2px; }
	.definition-popover { position: absolute; z-index: 20; left: 50%; transform: translateX(-50%); bottom: calc(100% + .75rem); display: none; width: min(22rem, calc(100vw - 3rem)); padding: .85rem 1rem; border: 1px solid color-mix(in oklab, var(--color-base-content) 18%, transparent); border-radius: .6rem; background: var(--color-base-100); color: var(--color-base-content); box-shadow: 0 12px 35px color-mix(in oklab, black 16%, transparent); font-size: .85rem; line-height: 1.55; }
	.definition-popover.open { display: block; }
	.hero-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 1.6rem; margin-top: 2rem; }
	.hero-actions .btn { height: 3.25rem; padding-inline: 1.4rem; gap: 1.5rem; }
	.hero-about { font-size: .85rem; font-weight: 600; }
	.hero-about:hover { text-decoration: underline; }
	.hero-about span { margin-left: .5rem; }
	.hero-atlas { position: absolute; width: min(64vw, 1050px); height: 100%; right: max(-2%, calc((100% - 1440px) / 2 - 12rem)); top: -8rem; }
	.hero-map-link { display: inline-block; margin-top: 1.25rem; font-size: .8rem; color: color-mix(in oklab, var(--color-base-content) 65%, transparent); }
	.hero-map-link:hover { text-decoration: underline; }
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
		.hero-description { max-width: 27rem; }
		.hero-inner { padding-bottom: 21.25rem; }
	}
	@media (max-width: 540px) {
		.definition { position: static; }
		.definition-popover { left: 0; transform: none; max-width: 100%; }
		.hero-atlas { top: 26rem; right: -13%; width: 120%; height: 26rem; opacity: 1; }
		.hero-inner { padding-bottom: 29.25rem; }
		.hero-description { max-width: 23rem; }
	}
</style>
