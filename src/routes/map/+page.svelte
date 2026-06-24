<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	import maplibregl, {
		type GeoJSONSource,
		type Map as MaplibreMap,
		type MapLayerMouseEvent,
		type StyleSpecification
	} from 'maplibre-gl';
	import { resolve } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import { pb, type CaseRecord } from '$lib/database';

	type JurisdictionCount = { jurisdiction: string; count: number };
	type MapPin = JurisdictionCount & { lng: number; lat: number };
	type Coordinates = { lng: number; lat: number };

	const casePinsSourceId = 'case-pins';
	const casePinsUrl = resolve('/cases');
	const geocodeCacheKey = 'map:jurisdiction-coordinates';
	const lightMapStyle: StyleSpecification = {
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
			},
			[casePinsSourceId]: {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
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
			},
			{
				id: 'case-pin-halo',
				type: 'circle',
				source: casePinsSourceId,
				paint: {
					'circle-radius': ['+', ['get', 'radius'], 8],
					'circle-color': '#facc15',
					'circle-opacity': 0.28
				}
			},
			{
				id: 'case-pin-circle',
				type: 'circle',
				source: casePinsSourceId,
				paint: {
					'circle-radius': ['get', 'radius'],
					'circle-color': '#facc15',
					'circle-stroke-color': '#ffffff',
					'circle-stroke-width': 3
				}
			},
			{
				id: 'case-pin-count',
				type: 'symbol',
				source: casePinsSourceId,
				layout: {
					'text-field': ['to-string', ['get', 'count']],
					'text-size': 14,
					'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
					'text-allow-overlap': true,
					'text-ignore-placement': true
				},
				paint: {
					'text-color': '#111827'
				}
			}
		]
	};

	let loading = $state(true);
	let error = $state('');
	let jurisdictions = $state<JurisdictionCount[]>([]);
	let jurisdictionCoordinates = $state<Record<string, Coordinates>>({});
	let mapContainer = $state<HTMLDivElement>();
	let map: MaplibreMap | undefined;

	const maxCount = $derived(Math.max(1, ...jurisdictions.map((item) => item.count)));
	const mapPins = $derived(
		jurisdictions
			.map((item) => {
				const coordinates = jurisdictionCoordinates[item.jurisdiction];
				return coordinates ? { ...item, ...coordinates } : undefined;
			})
			.filter(Boolean) as MapPin[]
	);

	function pinRadius(pin: MapPin) {
		return 18 + (pin.count / maxCount) * 10;
	}

	function pinHref(jurisdiction: string) {
		return `${casePinsUrl}?jurisdiction=${encodeURIComponent(jurisdiction)}`;
	}

	function normalizeJurisdiction(jurisdiction: string) {
		return jurisdiction === 'FR' ? 'France' : jurisdiction;
	}

	function readGeocodeCache() {
		try {
			return JSON.parse(localStorage.getItem(geocodeCacheKey) ?? '{}') as Record<string, Coordinates>;
		} catch {
			return {};
		}
	}

	function writeGeocodeCache(cache: Record<string, Coordinates>) {
		localStorage.setItem(geocodeCacheKey, JSON.stringify(cache));
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

	async function loadJurisdictionCoordinates(items: JurisdictionCount[]) {
		const cache = readGeocodeCache();

		for (const { jurisdiction } of items) {
			if (jurisdiction === 'Unknown' || cache[jurisdiction]) continue;
			const coordinates = await geocodeJurisdiction(jurisdiction);
			if (coordinates) cache[jurisdiction] = coordinates;
		}

		writeGeocodeCache(cache);
		jurisdictionCoordinates = cache;
	}

	function pinFeatureCollection() {
		return {
			type: 'FeatureCollection' as const,
			features: mapPins.map((pin) => ({
				type: 'Feature' as const,
				properties: {
					jurisdiction: pin.jurisdiction,
					count: pin.count,
					radius: pinRadius(pin)
				},
				geometry: {
					type: 'Point' as const,
					coordinates: [pin.lng, pin.lat]
				}
			}))
		};
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
		map.on('load', renderPins);
		map.on('click', 'case-pin-circle', openPin);
		map.on('click', 'case-pin-count', openPin);
		map.on('mouseenter', 'case-pin-circle', showPinCursor);
		map.on('mouseenter', 'case-pin-count', showPinCursor);
		map.on('mouseleave', 'case-pin-circle', hidePinCursor);
		map.on('mouseleave', 'case-pin-count', hidePinCursor);
	}

	function renderPins() {
		if (!map || !map.loaded()) return;
		(map.getSource(casePinsSourceId) as GeoJSONSource).setData(pinFeatureCollection());
	}

	function openPin(event: MapLayerMouseEvent) {
		const jurisdiction = event.features?.[0]?.properties?.jurisdiction;
		if (typeof jurisdiction === 'string') window.location.href = pinHref(jurisdiction);
	}

	function showPinCursor() {
		if (map) map.getCanvas().style.cursor = 'pointer';
	}

	function hidePinCursor() {
		if (map) map.getCanvas().style.cursor = '';
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
				const jurisdiction = normalizeJurisdiction(record.jurisdiction?.trim() || 'Unknown');
				counts.set(jurisdiction, (counts.get(jurisdiction) ?? 0) + 1);
			}
			jurisdictions = [...counts.entries()]
				.map(([jurisdiction, count]) => ({ jurisdiction, count }))
				.sort((a, b) => b.count - a.count || a.jurisdiction.localeCompare(b.jurisdiction));
			await loadJurisdictionCoordinates(jurisdictions);
		} catch (err) {
			console.error('Error loading map data:', err);
			error = 'Could not load jurisdiction data.';
		} finally {
			loading = false;
			await tick();
			initializeMap();
			renderPins();
		}
	}

	onMount(() => {
		loadMapData();

		return () => {
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
