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

	function moveCaseNetwork(event: PointerEvent) {
		const network = event.currentTarget as HTMLElement;
		const bounds = network.getBoundingClientRect();
		network.style.setProperty(
			'--pointer-x',
			`${((event.clientX - bounds.left) / bounds.width - 0.5) * 2}`
		);
		network.style.setProperty(
			'--pointer-y',
			`${((event.clientY - bounds.top) / bounds.height - 0.5) * 2}`
		);
	}

	function resetCaseNetwork(event: PointerEvent) {
		const network = event.currentTarget as HTMLElement;
		network.style.setProperty('--pointer-x', '0');
		network.style.setProperty('--pointer-y', '0');
	}
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
		<div class="grid items-center gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
			<div>
				<p class="mb-4 text-sm font-semibold tracking-[0.3em] text-primary uppercase">
					Private enforcement of the Digital Services Act
				</p>
				<h1 class="max-w-4xl text-4xl leading-tight font-black sm:text-6xl">
					A public case law tracker for DSA litigation across EU Member States.
				</h1>
				<p class="mt-6 max-w-3xl text-lg leading-8 text-base-content/75">
					The DSA Case Law Tracker is a public resource for IViR, the University of Amsterdam, and
					the DSA Observatory. It helps researchers collect, structure, review, and publish private
					enforcement cases while keeping the public site searchable, filterable, and easy to cite.
				</p>
				<div class="mt-8 flex flex-wrap gap-3">
					<a class="btn btn-primary" href={resolve('/cases')}>Open case database</a>
					<a class="btn btn-outline" href={resolve('/about')}>Learn more</a>
				</div>
			</div>

			<div
				class="case-network"
				onpointermove={moveCaseNetwork}
				onpointerleave={resetCaseNetwork}
				aria-hidden="true"
			>
				<div class="network-grid"></div>
				<div class="network-orbit orbit-one"></div>
				<div class="network-orbit orbit-two"></div>
				<div class="case-card case-card-back">
					<span>National court</span>
					<strong>Platform accountability</strong>
					<small>Private enforcement</small>
				</div>
				<div class="case-card case-card-front">
					<div class="flex items-center justify-between gap-3">
						<span class="case-status">Published case</span>
						<span class="case-country">EU</span>
					</div>
					<strong>Digital Services Act</strong>
					<div class="case-rule"></div>
					<div class="flex gap-2">
						<span class="case-tag">Case law</span>
						<span class="case-tag">DSA article</span>
					</div>
				</div>
				<span class="network-node node-one"></span>
				<span class="network-node node-two"></span>
				<span class="network-node node-three"></span>
				<span class="network-label label-one">Courts</span>
				<span class="network-label label-two">Sources</span>
				<span class="network-label label-three">Member States</span>
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

<style>
	.case-network {
		--pointer-x: 0;
		--pointer-y: 0;
		position: relative;
		isolation: isolate;
		min-height: 25rem;
		border: 1px solid color-mix(in oklab, var(--color-base-content) 12%, transparent);
		border-radius: 2.5rem;
		background:
			radial-gradient(
				circle at 75% 18%,
				color-mix(in oklab, var(--color-primary) 36%, transparent),
				transparent 28%
			),
			linear-gradient(
				145deg,
				color-mix(in oklab, var(--color-base-100) 92%, transparent),
				var(--color-base-200)
			);
		box-shadow: 0 2rem 5rem rgb(0 0 0 / 0.16);
		overflow: hidden;
		perspective: 900px;
	}

	.network-grid {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(
				color-mix(in oklab, var(--color-base-content) 7%, transparent) 1px,
				transparent 1px
			),
			linear-gradient(
				90deg,
				color-mix(in oklab, var(--color-base-content) 7%, transparent) 1px,
				transparent 1px
			);
		background-size: 2.5rem 2.5rem;
		mask-image: linear-gradient(to bottom right, black, transparent 85%);
		transform: translate(calc(var(--pointer-x) * -5px), calc(var(--pointer-y) * -5px));
		transition: transform 200ms ease-out;
	}

	.network-orbit {
		position: absolute;
		left: 50%;
		top: 50%;
		border: 1px solid color-mix(in oklab, var(--color-primary) 38%, transparent);
		border-radius: 50%;
		transform: translate(-50%, -50%) rotate(-18deg);
	}

	.orbit-one {
		width: 22rem;
		height: 11rem;
		animation: orbit 16s linear infinite;
	}

	.orbit-two {
		width: 16rem;
		height: 21rem;
		animation: orbit-reverse 21s linear infinite;
	}

	.case-card {
		position: absolute;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: min(17rem, 72%);
		border: 1px solid color-mix(in oklab, var(--color-base-content) 14%, transparent);
		border-radius: 1.5rem;
		background: color-mix(in oklab, var(--color-base-100) 91%, transparent);
		box-shadow: 0 1.5rem 3rem rgb(0 0 0 / 0.24);
		backdrop-filter: blur(16px);
		transition: transform 220ms ease-out;
	}

	.case-card strong {
		font-size: 1.15rem;
		line-height: 1.2;
	}

	.case-card-back {
		right: 5%;
		top: 12%;
		padding: 1.25rem;
		color: color-mix(in oklab, var(--color-base-content) 72%, transparent);
		transform: translate(calc(var(--pointer-x) * 8px), calc(var(--pointer-y) * 8px)) rotate(8deg);
	}

	.case-card-back span,
	.case-card-back small {
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.case-card-front {
		left: 10%;
		top: 35%;
		padding: 1.4rem;
		transform: translate(calc(var(--pointer-x) * 18px), calc(var(--pointer-y) * 18px)) rotate(-5deg);
	}

	.case-status,
	.case-tag,
	.case-country {
		border-radius: 999px;
		font-size: 0.65rem;
		font-weight: 700;
	}

	.case-status,
	.case-tag {
		border: 1px solid color-mix(in oklab, var(--color-base-content) 14%, transparent);
		padding: 0.35rem 0.6rem;
	}

	.case-country {
		display: grid;
		width: 1.8rem;
		height: 1.8rem;
		place-items: center;
		background: var(--color-primary);
		color: var(--color-primary-content);
	}

	.case-rule {
		height: 1px;
		background: color-mix(in oklab, var(--color-base-content) 12%, transparent);
	}

	.network-node {
		position: absolute;
		width: 0.65rem;
		height: 0.65rem;
		border: 2px solid var(--color-base-100);
		border-radius: 50%;
		background: var(--color-primary);
		box-shadow: 0 0 0 0.4rem color-mix(in oklab, var(--color-primary) 18%, transparent);
		animation: pulse 2.8s ease-in-out infinite;
	}

	.node-one {
		left: 12%;
		top: 20%;
	}
	.node-two {
		right: 12%;
		top: 55%;
		animation-delay: -0.9s;
	}
	.node-three {
		left: 35%;
		bottom: 10%;
		animation-delay: -1.8s;
	}

	.network-label {
		position: absolute;
		border: 1px solid color-mix(in oklab, var(--color-base-content) 12%, transparent);
		border-radius: 999px;
		background: color-mix(in oklab, var(--color-base-100) 82%, transparent);
		padding: 0.35rem 0.65rem;
		font-size: 0.65rem;
		font-weight: 700;
		backdrop-filter: blur(10px);
	}

	.label-one {
		left: 7%;
		top: 11%;
	}
	.label-two {
		right: 7%;
		top: 66%;
	}
	.label-three {
		left: 17%;
		bottom: 8%;
	}

	@keyframes orbit {
		to {
			transform: translate(-50%, -50%) rotate(342deg);
		}
	}

	@keyframes orbit-reverse {
		to {
			transform: translate(-50%, -50%) rotate(-378deg);
		}
	}

	@keyframes pulse {
		50% {
			box-shadow: 0 0 0 0.75rem color-mix(in oklab, var(--color-primary) 4%, transparent);
		}
	}

	@media (max-width: 639px) {
		.case-network {
			min-height: 21rem;
		}
		.case-card-front {
			left: 8%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.network-orbit,
		.network-node {
			animation: none;
		}

		.network-grid,
		.case-card {
			transition: none;
		}
	}
</style>
