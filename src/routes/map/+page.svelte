<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	import maplibregl, { type Map, type Marker } from 'maplibre-gl';
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import { pb, type CaseRecord } from '$lib/database';

	type JurisdictionCount = { jurisdiction: string; count: number };
	type MapPin = JurisdictionCount & { lng: number; lat: number };

	const jurisdictionCoordinates: Record<string, { lng: number; lat: number }> = {
		Denmark: { lng: 9.5018, lat: 56.2639 },
		FR: { lng: 2.2137, lat: 46.2276 },
		France: { lng: 2.2137, lat: 46.2276 },
		Germany: { lng: 10.4515, lat: 51.1657 },
		Netherlands: { lng: 5.2913, lat: 52.1326 },
		Poland: { lng: 19.1451, lat: 51.9194 },
		Spain: { lng: -3.7492, lat: 40.4637 }
	};
	const lightMapStyle = {
		version: 8,
		sources: {
			'carto-voyager': {
				type: 'raster',
				tiles: [
					'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
					'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
					'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
					'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
				],
				tileSize: 256,
				attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
			}
		},
		layers: [
			{
				id: 'background',
				type: 'background',
				paint: { 'background-color': '#f8fafc' }
			},
			{
				id: 'carto-voyager',
				type: 'raster',
				source: 'carto-voyager',
				paint: { 'raster-opacity': 0.86 }
			}
		]
	} as const;

	let loading = $state(true);
	let error = $state('');
	let jurisdictions = $state<JurisdictionCount[]>([]);
	let mapContainer = $state<HTMLDivElement>();
	let map: Map | undefined;
	let markers: Marker[] = [];

	const maxCount = $derived(Math.max(1, ...jurisdictions.map((item) => item.count)));
	const mapPins = $derived(
		jurisdictions
			.map((item) => {
				const coordinates = jurisdictionCoordinates[item.jurisdiction];
				return coordinates ? { ...item, ...coordinates } : undefined;
			})
			.filter(Boolean) as MapPin[]
	);

	function pinSize(pin: MapPin) {
		return 2.25 + (pin.count / maxCount) * 1.25;
	}

	function initializeMap() {
		if (!mapContainer || map) return;

		map = new maplibregl.Map({
			container: mapContainer,
			style: lightMapStyle,
			center: [10, 49],
			zoom: 2.8,
			attributionControl: false
		});

		map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
		map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
		map.on('load', renderMarkers);
	}

	function renderMarkers() {
		if (!map) return;
		markers.forEach((marker) => marker.remove());
		markers = [];

		for (const pin of mapPins) {
			const markerElement = document.createElement('a');
			markerElement.href = `${resolve('/cases')}?jurisdiction=${encodeURIComponent(pin.jurisdiction)}`;
			markerElement.className = 'case-map-marker';
			markerElement.style.width = `${pinSize(pin)}rem`;
			markerElement.style.height = `${pinSize(pin)}rem`;
			markerElement.textContent = String(pin.count);
			markerElement.title = `${pin.jurisdiction}: ${pin.count} cases`;

			const marker = new maplibregl.Marker({ element: markerElement })
				.setLngLat([pin.lng, pin.lat])
				.addTo(map);

			markers.push(marker);
		}
	}

	async function loadMapData() {
		loading = true;
		error = '';

		try {
			const cases = await pb.collection('cases').getFullList<CaseRecord>({
				filter: 'published = true',
				sort: 'jurisdiction'
			});
			const counts = new Map<string, number>();
			for (const record of cases) {
				const jurisdiction = record.jurisdiction?.trim() || 'Unknown';
				counts.set(jurisdiction, (counts.get(jurisdiction) ?? 0) + 1);
			}
			jurisdictions = [...counts.entries()]
				.map(([jurisdiction, count]) => ({ jurisdiction, count }))
				.sort((a, b) => b.count - a.count || a.jurisdiction.localeCompare(b.jurisdiction));
		} catch (err) {
			console.error('Error loading map data:', err);
			error = 'Could not load jurisdiction data.';
		} finally {
			loading = false;
			await tick();
			initializeMap();
			renderMarkers();
		}
	}

	onMount(() => {
		loadMapData();

		return () => {
			markers.forEach((marker) => marker.remove());
			map?.remove();
			map = undefined;
		};
	});
</script>

<svelte:head>
	<title>Jurisdiction Map | DSA Case Law Tracker</title>
	<meta name="description" content="Browse DSA private enforcement cases by jurisdiction." />
</svelte:head>

<main class="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
	<section class="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
		<div class="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<div>
				<p class="text-sm font-semibold tracking-[0.24em] text-primary uppercase">
					Geographic view
				</p>
				<h1 class="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
					Case distribution by jurisdiction
				</h1>
				<p class="mt-4 max-w-2xl text-slate-600">
					This MVP map view shows where published DSA private enforcement records are concentrated.
					A full MapLibre EU map can replace this once the production jurisdiction dataset is
					stable.
				</p>
			</div>
			<div class="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
				<div class="text-3xl font-black text-slate-950">
					{jurisdictions.reduce((sum, item) => sum + item.count, 0)}
				</div>
				<div>published cases with jurisdiction data</div>
			</div>
		</div>

		<div class="border-t border-slate-200 bg-slate-50 p-6 sm:p-8">
			{#if loading}
				<p class="text-slate-500">Loading jurisdiction data...</p>
			{:else if error}
				<p class="text-red-700">{error}</p>
			{:else if !jurisdictions.length}
				<p class="text-slate-500">No published cases with jurisdiction data yet.</p>
			{:else}
				<div
					class="relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-100 shadow-inner"
				>
					<div
						bind:this={mapContainer}
						class="h-[24rem] w-full"
						aria-label="Global map showing case counts by jurisdiction"
					></div>

					<div
						class="absolute right-4 bottom-4 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-600 shadow-sm backdrop-blur"
					>
						<span class="font-semibold text-slate-950">Pin number</span> = published cases
					</div>
				</div>

				<div class="mt-5 space-y-3">
					{#each jurisdictions as item}
						<a
							class="group grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-center"
							href={`${resolve('/cases')}?jurisdiction=${encodeURIComponent(item.jurisdiction)}`}
						>
							<div class="font-semibold text-slate-950">{item.jurisdiction}</div>
							<div class="h-3 overflow-hidden rounded-full bg-slate-200">
								<div
									class="h-full rounded-full bg-primary"
									style={`width: ${(item.count / maxCount) * 100}%`}
								></div>
							</div>
							<div class="text-sm font-semibold text-slate-600">{item.count} cases</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	</section>
</main>

<style>
	:global(.case-map-marker) {
		display: grid;
		place-items: center;
		border: 3px solid white;
		border-radius: 9999px;
		background: var(--color-primary);
		box-shadow:
			0 10px 24px rgb(15 23 42 / 0.22),
			0 0 0 8px color-mix(in oklab, var(--color-primary) 22%, transparent);
		color: var(--color-primary-content);
		font-size: 0.9rem;
		font-weight: 900;
		line-height: 1;
		text-decoration: none;
		transition:
			transform 160ms ease,
			box-shadow 160ms ease;
	}

	:global(.case-map-marker:hover) {
		transform: scale(1.08);
		box-shadow:
			0 14px 30px rgb(15 23 42 / 0.28),
			0 0 0 10px color-mix(in oklab, var(--color-primary) 28%, transparent);
	}
</style>
