<script lang="ts">
	import { base, resolve } from '$app/paths';
	import { page } from '$app/state';

	const compact = $derived(page.route.id === '/cases' || page.route.id === '/home-2');
</script>

<footer class:compact aria-label="Site footer">
	<div class="footer-inner">
		<div class="partners" aria-label="Project partners">
			<a href="https://dsa-observatory.eu/" aria-label="DSA Observatory website">
				<img src={`${base}/brand/dsa-observatory-logo.png`} alt="DSA Observatory" class="dsa-logo" />
			</a>
			<a href="https://www.uva.nl/en" aria-label="University of Amsterdam website">
				<img
					src={`${base}/brand/university-of-amsterdam-logo.jpg`}
					alt="University of Amsterdam"
					class="uva-logo"
				/>
			</a>
		</div>

		<nav aria-label="Footer navigation">
			<a href={resolve('/about')}>About</a>
			<a href={resolve('/submit')}>Suggest case</a>
			<a href={resolve('/privacy')}>Privacy</a>
			<a href={resolve('/policy')}>Policy</a>
		</nav>
	</div>
</footer>

<style>
	footer {
		border-top: 1px solid color-mix(in oklab, var(--color-base-content) 14%, transparent);
		background: var(--color-base-100);
	}

	.footer-inner {
		width: min(100% - 2rem, 80rem);
		margin-inline: auto;
		padding-block: 2rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 2rem;
	}

	.partners,
	nav {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
	}

	.partners { gap: 1.5rem; }
	nav { justify-content: flex-end; gap: .6rem 1.5rem; }

	.partners a { display: inline-flex; }
	.partners img { display: block; width: auto; object-fit: contain; }
	.dsa-logo { height: 4.25rem; }
	.uva-logo { height: 3rem; max-width: min(20rem, 52vw); }

	nav a {
		font-size: .875rem;
		font-weight: 600;
		text-underline-offset: .25rem;
	}

	nav a:hover,
	nav a:focus-visible { text-decoration: underline; }

	@media (min-width: 768px) {
		footer.compact { height: 2.75rem; }
		footer.compact .footer-inner { width: min(100% - 2rem, 105rem); height: 100%; padding-block: .25rem; }
		footer.compact .partners { gap: 1rem; }
		footer.compact .dsa-logo { height: 2rem; }
		footer.compact .uva-logo { height: 1.65rem; max-width: 13rem; }
		footer.compact nav { gap: 1rem; }
		footer.compact nav a { font-size: .75rem; }
	}

	@media (max-width: 767px) {
		.footer-inner { align-items: flex-start; flex-direction: column; }
		nav { justify-content: flex-start; }
	}
</style>
