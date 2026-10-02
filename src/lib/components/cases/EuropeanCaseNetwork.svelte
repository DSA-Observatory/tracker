<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { pb, type CaseRecord } from '$lib/database';

	type Coordinates = { lng: number; lat: number };
	type JurisdictionPin = Coordinates & { jurisdiction: string; count: number };

	const casesUrl = resolve('/cases');
	const geocodeCacheKey = 'map:jurisdiction-coordinates';
	const defaultCoordinates: Record<string, Coordinates> = {
		Austria: { lng: 14.5501, lat: 47.5162 },
		Denmark: { lng: 9.5018, lat: 56.2639 },
		France: { lng: 2.2137, lat: 46.2276 },
		Germany: { lng: 10.4515, lat: 51.1657 },
		Netherlands: { lng: 5.2913, lat: 52.1326 },
		Poland: { lng: 19.1451, lat: 51.9194 },
		Spain: { lng: -3.7492, lat: 40.4637 }
	};

	let network = $state<HTMLElement>();
	let pins = $state<JurisdictionPin[]>([]);
	let visible = $state(true);
	let documentVisible = $state(true);

	const active = $derived(visible && documentVisible);

	function normalizeJurisdiction(jurisdiction: string) {
		return jurisdiction === 'FR' ? 'France' : jurisdiction;
	}

	function readGeocodeCache() {
		try {
			return JSON.parse(localStorage.getItem(geocodeCacheKey) ?? '{}') as Record<
				string,
				Coordinates
			>;
		} catch {
			return {};
		}
	}

	async function geocodeJurisdiction(jurisdiction: string) {
		const url = new URL('https://nominatim.openstreetmap.org/search');
		url.searchParams.set('format', 'jsonv2');
		url.searchParams.set('limit', '1');
		url.searchParams.set('q', jurisdiction);
		const response = await fetch(url);
		if (!response.ok) return undefined;
		const [result] = (await response.json()) as { lat: string; lon: string }[];
		return result ? { lng: Number(result.lon), lat: Number(result.lat) } : undefined;
	}

	async function loadPins() {
		try {
			const records = await pb.collection('cases').getFullList<CaseRecord>({
				fields: 'jurisdiction',
				filter: "published = true && status != 'archived'",
				sort: 'jurisdiction'
			});
			const counts = new Map<string, number>();
			for (const record of records) {
				const jurisdiction = normalizeJurisdiction(record.jurisdiction?.trim() || 'Unknown');
				if (jurisdiction !== 'Unknown') counts.set(jurisdiction, (counts.get(jurisdiction) ?? 0) + 1);
			}

			const coordinates = { ...defaultCoordinates, ...readGeocodeCache() };
			for (const jurisdiction of counts.keys()) {
				if (coordinates[jurisdiction]) continue;
				try {
					const result = await geocodeJurisdiction(jurisdiction);
					if (result) coordinates[jurisdiction] = result;
				} catch (error) {
					console.warn(`Could not geocode ${jurisdiction}:`, error);
				}
			}
			try {
				localStorage.setItem(geocodeCacheKey, JSON.stringify(coordinates));
			} catch {
				// Pins still render when browser storage is unavailable.
			}

			pins = [...counts]
				.map(([jurisdiction, count]) => ({ jurisdiction, count, ...coordinates[jurisdiction] }))
				.filter((pin): pin is JurisdictionPin => Number.isFinite(pin.lng) && Number.isFinite(pin.lat))
				.sort((a, b) => b.count - a.count || a.jurisdiction.localeCompare(b.jurisdiction));
		} catch (error) {
			console.error('Error loading hero jurisdiction data:', error);
		}
	}

	function pinPosition(pin: JurisdictionPin) {
		return `--pin-x:${((pin.lng + 25) / 70) * 100}%;--pin-y:${((72 - pin.lat) / 38) * 100}%`;
	}

	function pinHref(jurisdiction: string) {
		return `${casesUrl}?jurisdiction=${encodeURIComponent(jurisdiction)}`;
	}

	onMount(() => {
		loadPins();
		documentVisible = !document.hidden;
		const observer = new IntersectionObserver(([entry]) => {
			if (entry) visible = entry.isIntersecting;
		}, { rootMargin: '80px' });
		if (network) observer.observe(network);
		const handleVisibility = () => (documentVisible = !document.hidden);
		document.addEventListener('visibilitychange', handleVisibility);
		return () => {
			observer.disconnect();
			document.removeEventListener('visibilitychange', handleVisibility);
		};
	});
</script>

<section
	bind:this={network}
	class:network-active={active}
	class="case-network"
	aria-label="Published DSA cases by European jurisdiction"
>
	<div class="network-grid" aria-hidden="true"></div>
	<div class="map-depth">
		<img src={resolve('/maps/europe-natural-earth.svg')} alt="" class="europe-map" draggable="false" />
		<div class="pins">
			{#each pins as pin, index (pin.jurisdiction)}
				<a
					class="case-pin"
					href={pinHref(pin.jurisdiction)}
					style={`${pinPosition(pin)};--pin-delay:${index * 90}ms`}
					aria-label={`${pin.jurisdiction}: ${pin.count} published ${pin.count === 1 ? 'case' : 'cases'}`}
				>
					<span class="pin-halo"></span>
					<span class="pin-count">{pin.count}</span>
					<span class="pin-label">
						<strong>{pin.jurisdiction}</strong>
						<small>{pin.count} published {pin.count === 1 ? 'case' : 'cases'}</small>
					</span>
				</a>
			{/each}
		</div>
	</div>
</section>

<style>
	.case-network {
		position: relative;
		isolation: isolate;
		height: 100%;
		min-height: 25rem;
	}

	.network-grid {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(circle, color-mix(in oklab, var(--color-base-content) 14%, transparent) 1px, transparent 1px);
		background-size: 1.25rem 1.25rem;
		mask-image: radial-gradient(ellipse at center, black 15%, transparent 72%);
		opacity: 0.55;
	}

	.map-depth {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 100%;
		aspect-ratio: 560 / 456;
		transform: translate(-50%, -50%);
	}

	.europe-map,
	.pins {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.europe-map {
		pointer-events: none;
		user-select: none;
		-webkit-user-drag: none;
		object-fit: contain;
		opacity: 0.38;
		mask-image:
			linear-gradient(to bottom, transparent, rgb(0 0 0 / 20%) 20%, black 52%, black 90%, transparent),
			linear-gradient(to right, black 65%, rgb(0 0 0 / 70%) 80%, transparent 100%),
			radial-gradient(ellipse at 53% 68%, black 40%, rgb(0 0 0 / 65%) 65%, transparent 85%);
		mask-composite: intersect;
	}

	.pins {
		pointer-events: none;
	}

	.case-pin {
		position: absolute;
		left: var(--pin-x);
		top: var(--pin-y);
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border-radius: 999px;
		color: var(--color-primary-content);
		text-decoration: none;
		transform: translate(-50%, -50%);
		pointer-events: auto;
		z-index: 2;
	}

	.pin-halo {
		position: absolute;
		inset: -0.35rem;
		border: 1px solid color-mix(in oklab, var(--color-primary) 70%, transparent);
		border-radius: inherit;
		background: color-mix(in oklab, var(--color-primary) 20%, transparent);
		box-shadow: 0 0 1.25rem color-mix(in oklab, var(--color-primary) 55%, transparent);
		animation: pin-breathe 3.6s ease-in-out infinite;
		animation-play-state: paused;
	}

	.network-active .pin-halo {
		animation-play-state: running;
	}

	.pin-count {
		position: relative;
		display: grid;
		width: 1.7rem;
		height: 1.7rem;
		place-items: center;
		border: 2px solid color-mix(in oklab, var(--color-base-100) 88%, transparent);
		border-radius: inherit;
		background: var(--color-primary);
		font-size: 0.72rem;
		font-weight: 900;
		box-shadow: 0 0.35rem 1rem rgb(0 0 0 / 0.24);
	}

	.pin-label {
		position: absolute;
		left: 50%;
		bottom: calc(100% + 0.65rem);
		min-width: max-content;
		border: 1px solid color-mix(in oklab, var(--color-base-content) 12%, transparent);
		border-radius: 0.8rem;
		background: color-mix(in oklab, var(--color-base-100) 94%, transparent);
		padding: 0.5rem 0.65rem;
		color: var(--color-base-content);
		box-shadow: 0 0.8rem 2rem rgb(0 0 0 / 0.16);
		opacity: 0;
		transform: translate(-50%, 0.3rem);
		transition: opacity 160ms ease, transform 160ms ease;
		pointer-events: none;
	}

	.pin-label strong,
	.pin-label small {
		display: block;
	}

	.pin-label strong { font-size: 0.78rem; }
	.pin-label small { margin-top: 0.1rem; font-size: 0.65rem; opacity: 0.65; }

	.case-pin:hover,
	.case-pin:focus-visible { z-index: 4; }
	.case-pin:hover .pin-label,
	.case-pin:focus-visible .pin-label { opacity: 1; transform: translate(-50%, 0); }
	.case-pin:focus-visible { outline: 3px solid color-mix(in oklab, var(--color-primary) 45%, transparent); outline-offset: 0.35rem; }

	@keyframes pin-breathe { 50% { transform: scale(1.16); opacity: 0.55; } }
	@media (prefers-reduced-motion: no-preference) {
		.case-pin { animation: pin-entry .85s var(--pin-delay) cubic-bezier(.16, 1, .3, 1) both; }
	}
	@keyframes pin-entry {
		from { opacity: 0; transform: translate(-50%, -50%) scale(.2); }
		to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
	}

	@media (max-width: 639px) {
		.case-network { min-height: 21rem; }
		.map-depth { width: 100%; }
		.pin-label { left: auto; right: -2rem; transform: translateY(0.3rem); }
		.case-pin:hover .pin-label,
		.case-pin:focus-visible .pin-label { transform: translateY(0); }
	}

	@media (prefers-reduced-motion: reduce) {
		.map-depth,
		.pin-halo { animation: none; }
		.map-depth,
		.network-grid,
		.pin-label { transition: none; }
	}
</style>
