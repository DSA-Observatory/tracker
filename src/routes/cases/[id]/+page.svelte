<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { authStore, pb, type CaseRecord } from '$lib/database';

	let record = $state<CaseRecord>();
	let relatedCases = $state<CaseRecord[]>([]);
	let loading = $state(true);
	let error = $state('');

	const canWrite = $derived(authStore.isAuthenticated);
	const sourceLinks = $derived(buildSourceLinks(record));
	const documentFiles = $derived(record?.documents ?? []);
	const proceduralEvents = $derived(normalizeProceduralEvents(record));

	function stripHtml(value?: string) {
		return (value ?? '')
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function formatDate(value?: string) {
		if (!value) return '';
		return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value));
	}

	function list(values?: string[]) {
		return Array.isArray(values) ? values.filter(Boolean) : [];
	}

	function extractUrls(value?: string) {
		return Array.from((value ?? '').matchAll(/https?:\/\/[^\s)]+/g), (match) =>
			match[0].replace(/[.,;]+$/, '')
		);
	}

	function buildSourceLinks(item?: CaseRecord) {
		if (!item) return [];
		const links = [
			...(item.document_links ?? []),
			...extractUrls(item.summary),
			...extractUrls(item.timeline),
			...extractUrls(item.commentary),
			...(item.primary_sources ?? []).flatMap(extractUrls),
			...(item.secondary_sources ?? []).flatMap(extractUrls)
		];

		return [...new Map(links.filter(Boolean).map((link) => [link.toLowerCase(), link])).values()];
	}

	function sourceLabel(url: string) {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	}

	function shortUrlLabel(url: string) {
		return url.length > 72 ? `${url.slice(0, 69)}...` : url;
	}

	function documentUrl(filename: string) {
		return record ? pb.files.getURL(record, filename) : '#';
	}

	function linkedTextParts(value?: string) {
		const parts: { text: string; href?: string }[] = [];
		let lastIndex = 0;

		for (const match of (value ?? '').matchAll(/https?:\/\/[^\s)]+/g)) {
			const rawUrl = match[0];
			const href = rawUrl.replace(/[.,;]+$/, '');
			const index = match.index ?? 0;
			if (index > lastIndex) parts.push({ text: (value ?? '').slice(lastIndex, index) });
			parts.push({ text: shortUrlLabel(href), href });
			lastIndex = index + href.length;
		}

		if (lastIndex < (value ?? '').length) parts.push({ text: (value ?? '').slice(lastIndex) });
		return parts;
	}

	function linkifyHtml(value?: string) {
		const linkifyText = (text: string) =>
			text.replace(/https?:\/\/[^\s<")]+/g, (rawUrl) => {
				const href = rawUrl.replace(/[.,;]+$/, '');
				const trailing = rawUrl.slice(href.length);
				return `<a href="${href}" target="_blank" rel="noreferrer">${shortUrlLabel(href)}</a>${trailing}`;
			});

		return (value ?? '')
			.split(/(<[^>]+>)/g)
			.map((part) => (part.startsWith('<') ? part : linkifyText(part)))
			.join('');
	}

	function normalizeProceduralEvents(item?: CaseRecord) {
		if (!item) return [];
		if (Array.isArray(item.procedural_events) && item.procedural_events.length) {
			return item.procedural_events.filter(
				(event) => event.date || event.label || event.description
			);
		}
		return stripHtml(item.timeline)
			? [{ label: 'Timeline', description: stripHtml(item.timeline) }]
			: [];
	}

	async function loadCase() {
		loading = true;
		error = '';

		try {
			const id = page.params.id;
			if (!id) throw new Error('Missing case id.');
			record = await pb.collection('cases').getOne<CaseRecord>(id);
			if (!record.published && !authStore.isAuthenticated) {
				error = 'This case is not published.';
				record = undefined;
				return;
			}

			const legalTags = [
				...list(record.dsa_articles),
				...list(record.legal_areas),
				...list(record.themes)
			];
			if (legalTags.length) {
				relatedCases = (
					await pb.collection('cases').getFullList<CaseRecord>({ sort: '-decision_date,-created' })
				)
					.filter((item) => item.id !== record?.id && (item.published || authStore.isAuthenticated))
					.filter((item) =>
						[...list(item.dsa_articles), ...list(item.legal_areas), ...list(item.themes)].some(
							(tag) => legalTags.includes(tag)
						)
					)
					.slice(0, 4);
			}
		} catch (err) {
			console.error('Error loading case:', err);
			error = 'Could not load this case.';
		} finally {
			loading = false;
		}
	}

	onMount(loadCase);
</script>

<svelte:head>
	<title>{record ? `${record.title} | DSA Case Law Tracker` : 'Case | DSA Case Law Tracker'}</title>
	<meta name="description" content={record ? stripHtml(record.summary) : 'DSA case record'} />
</svelte:head>

<main class="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
	<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<button class="btn btn-ghost btn-sm" type="button" onclick={() => goto(resolve('/cases'))}>
			Back to cases
		</button>
		{#if canWrite && record}
			<a class="btn btn-outline btn-sm" href={resolve(`/cases/${record.id}/edit`)}>Edit case</a>
		{/if}
	</div>

	{#if loading}
		<div class="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500">
			Loading case...
		</div>
	{:else if error}
		<div class="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-700">{error}</div>
	{:else if record}
		<section class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
			<div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
				<div class="max-w-4xl">
					<p class="text-xs font-semibold tracking-[0.24em] text-slate-400 uppercase">
						Canonical case record
					</p>
					<h1
						class="mt-3 text-3xl leading-tight font-black tracking-tight text-slate-950 md:text-5xl"
					>
						{record.title}
					</h1>
					<div class="mt-4 flex flex-wrap gap-2 text-sm">
						<span class="rounded-full bg-slate-100 px-3 py-1 font-medium capitalize"
							>{record.status}</span
						>
						{#if record.outcome}<span
								class="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700"
								>{record.outcome}</span
							>{/if}
						{#if record.case_scope}<span
								class="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700"
								>{record.case_scope}</span
							>{/if}
					</div>
				</div>
				<div
					class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 lg:w-80"
				>
					<div class="font-mono text-xs text-slate-400">{record.case_id}</div>
					{#if record.ecli}<div class="mt-2 font-mono text-xs">{record.ecli}</div>{/if}
					<div class="mt-3">Last updated {formatDate(record.updated)}</div>
				</div>
			</div>
		</section>

		<div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<div class="space-y-6">
				<section class="rounded-2xl border border-slate-200 bg-white p-6">
					<h2 class="text-xl font-black">Summary</h2>
					{#if record.summary}<div class="prose mt-4 max-w-none text-slate-700">
							{@html linkifyHtml(record.summary)}
						</div>{:else}<p class="mt-4 text-slate-500">No summary has been added yet.</p>{/if}
				</section>

				<section class="rounded-2xl border border-slate-200 bg-white p-6">
					<h2 class="text-xl font-black">Procedural Timeline</h2>
					{#if proceduralEvents.length}
						<ol class="mt-4 space-y-3">
							{#each proceduralEvents as event}
								<li class="rounded-xl border border-slate-100 bg-slate-50 p-4">
									{#if event.date}<div class="text-xs font-semibold text-slate-400">
											{formatDate(event.date)}
										</div>{/if}
									<div class="font-semibold text-slate-950">
										{event.label || 'Procedural event'}
									</div>
									{#if event.description}<p class="mt-1 text-sm text-slate-600">
											{#each linkedTextParts(event.description) as part}
												{#if part.href}<a
														class="underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
														href={part.href}
														target="_blank"
														rel="noreferrer">{part.text}</a
													>{:else}{part.text}{/if}
											{/each}
										</p>{/if}
								</li>
							{/each}
						</ol>
					{:else}
						<p class="mt-4 text-slate-500">No timeline has been added yet.</p>
					{/if}
				</section>

				<section class="rounded-2xl border border-slate-200 bg-white p-6">
					<h2 class="text-xl font-black">Documents & References</h2>
					{#if documentFiles.length || sourceLinks.length || list(record.primary_sources).length || list(record.secondary_sources).length}
						{#if documentFiles.length}
							<div class="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
								<h3 class="font-semibold">Uploaded documents</h3>
								<ul class="mt-2 space-y-2 text-sm text-slate-600">
									{#each documentFiles as filename}
										<li>
											<a
												class="underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
												href={documentUrl(filename)}
												target="_blank"
												rel="noreferrer"
											>
												{filename}
											</a>
										</li>
									{/each}
								</ul>
							</div>
						{/if}
						<div class="mt-4 grid gap-4 md:grid-cols-2">
							<div>
								<h3 class="font-semibold">Primary sources</h3>
								<ul class="mt-2 space-y-2 text-sm text-slate-600">
									{#each list(record.primary_sources) as source}<li>
											{#each linkedTextParts(source) as part}
												{#if part.href}<a
														class="underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
														href={part.href}
														target="_blank"
														rel="noreferrer">{part.text}</a
													>{:else}{part.text}{/if}
											{/each}
										</li>{/each}
									{#if !list(record.primary_sources).length}<li>None recorded</li>{/if}
								</ul>
							</div>
							<div>
								<h3 class="font-semibold">Secondary sources</h3>
								<ul class="mt-2 space-y-2 text-sm text-slate-600">
									{#each list(record.secondary_sources) as source}<li>
											{#each linkedTextParts(source) as part}
												{#if part.href}<a
														class="underline decoration-slate-300 underline-offset-2 hover:text-slate-950"
														href={part.href}
														target="_blank"
														rel="noreferrer">{part.text}</a
													>{:else}{part.text}{/if}
											{/each}
										</li>{/each}
									{#if !list(record.secondary_sources).length}<li>None recorded</li>{/if}
								</ul>
							</div>
						</div>
						{#if sourceLinks.length}
							<div class="mt-5 flex flex-wrap gap-2">
								{#each sourceLinks as link}
									<a
										class="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
										href={link}
										target="_blank"
										rel="noreferrer">{sourceLabel(link)}</a
									>
								{/each}
							</div>
						{/if}
					{:else}
						<p class="mt-4 text-slate-500">No documents or references have been added yet.</p>
					{/if}
					{#if record.source_limitations}<div
							class="prose mt-5 max-w-none rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
						>
							{@html record.source_limitations}
						</div>{/if}
				</section>

				{#if record.commentary}
					<section class="rounded-2xl border border-slate-200 bg-white p-6">
						<h2 class="text-xl font-black">Commentary & Context</h2>
						<div class="prose mt-4 max-w-none text-slate-700">
							{@html linkifyHtml(record.commentary)}
						</div>
					</section>
				{/if}
			</div>

			<aside class="space-y-6">
				<section class="rounded-2xl border border-slate-200 bg-white p-5">
					<h2 class="font-black">At a glance</h2>
					<dl class="mt-4 space-y-3 text-sm">
						{#each [['Jurisdiction', record.jurisdiction], ['Court', list(record.courts).join(', ') || record.court], ['Filing date', formatDate(record.filing_date)], ['Decision date', formatDate(record.decision_date)], ['Plaintiffs', list(record.plaintiffs).join(', ')], ['Defendants', list(record.defendants).join(', ')]] as item}
							{#if item[1]}
								<div>
									<dt class="text-slate-400">{item[0]}</dt>
									<dd class="font-medium text-slate-800">{item[1]}</dd>
								</div>
							{/if}
						{/each}
					</dl>
				</section>

				<section class="rounded-2xl border border-slate-200 bg-white p-5">
					<h2 class="font-black">Legal classification</h2>
					<div class="mt-4 flex flex-wrap gap-2">
						{#each [...list(record.dsa_articles), ...list(record.legal_areas), ...list(record.legal_basis), ...list(record.categories), ...list(record.themes)] as tag}
							<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
								>{tag}</span
							>
						{/each}
					</div>
				</section>

				{#if relatedCases.length}
					<section class="rounded-2xl border border-slate-200 bg-white p-5">
						<h2 class="font-black">Related cases</h2>
						<div class="mt-4 space-y-3">
							{#each relatedCases as related}
								<a
									class="block rounded-xl border border-slate-100 p-3 text-sm hover:bg-slate-50"
									href={resolve(`/cases/${related.id}`)}
								>
									<div class="font-semibold text-slate-950">{related.title}</div>
									<div class="mt-1 text-xs text-slate-500">
										{related.jurisdiction || 'Unknown jurisdiction'}
									</div>
								</a>
							{/each}
						</div>
					</section>
				{/if}
			</aside>
		</div>
	{/if}
</main>
