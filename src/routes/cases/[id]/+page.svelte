<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { claimEntryAnimation } from '$lib/entry-animation';
	import { authStore, pb, type CaseRecord } from '$lib/database';
	import CaseSourceList from '$lib/components/cases/CaseSourceList.svelte';
	import { orderedDocumentFiles } from '$lib/case-sources';
	import CountryFlag from '$lib/components/CountryFlag.svelte';
	import IconArrowLeft from '~icons/lucide/arrow-left';
	import IconPencil from '~icons/lucide/pencil';
	import IconMapPin from '~icons/lucide/map-pin';

	let record = $state<CaseRecord>();
	let relatedCases = $state<CaseRecord[]>([]);
	let loading = $state(true);
	let error = $state('');
	let fileToken = $state('');
	let relatedError = $state('');
	let loadGeneration = 0;
	const playEntry = browser && claimEntryAnimation('case-detail');

	const canWrite = $derived(authStore.isAdmin);
	const sources = $derived([
		...new Set([
			...(record?.primary_sources ?? []),
			...(record?.secondary_sources ?? []),
			...(record?.document_links ?? [])
		])
	]);
	const documentFiles = $derived(orderedDocumentFiles(record?.documents, record?.document_order));
	const provisions = $derived([
		...new Set([...list(record?.dsa_articles), ...list(record?.legal_basis)])
	]);
	const categories = $derived(
		list(record?.categories).map((category) =>
			category.toLowerCase() === 'due diligence' ? 'Due Diligence' : category
		)
	);

	function categoryStyle(category: string) {
		if (category === 'Intermediary Liability') return 'bg-blue-50 text-blue-700';
		if (category === 'Due Diligence') return 'bg-emerald-50 text-emerald-700';
		return 'bg-slate-100 text-slate-600';
	}

	function reveal(node: HTMLElement, delay = 0) {
		if (!playEntry) return;
		node.style.setProperty('--entry-delay', `${delay}ms`);
		node.classList.add('case-entry');
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					node.classList.add('case-entered');
					observer.disconnect();
				}
			},
			{ threshold: 0.08 }
		);
		observer.observe(node);
		return { destroy: () => observer.disconnect() };
	}

	function stripHtml(value?: string) {
		return (value ?? '')
			.replace(/<[^>]+>/g, ' ')
			.replace(/&nbsp;/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function formatDate(value?: string) {
		if (!value) return '';
		const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
		const date = dateOnly
			? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])))
			: new Date(value);
		return Number.isNaN(date.getTime())
			? value
			: new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
	}

	function list(values?: string[]) {
		return Array.isArray(values) ? values.filter(Boolean) : [];
	}

	function shortUrlLabel(url: string) {
		return url.length > 72 ? `${url.slice(0, 69)}...` : url;
	}

	function documentUrl(filename: string) {
		if (!record) return '#';
		return fileToken
			? pb.files.getURL(record, filename, { token: fileToken })
			: pb.files.getURL(record, filename);
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

	async function loadCase(id: string) {
		const generation = ++loadGeneration;
		loading = true;
		error = '';
		relatedError = '';
		relatedCases = [];
		fileToken = '';

		try {
			const loaded = await pb.collection('cases').getOne<CaseRecord>(id);
			if (generation !== loadGeneration) return;
			record = loaded;
			if (authStore.isAdmin && record.documents?.length) fileToken = await pb.files.getToken();
			if (!record.published && !authStore.isAdmin) {
				error = 'This case is not published.';
				record = undefined;
				return;
			}

			if (Array.isArray(record.related_cases)) {
				const relationFilter = [
					pb.filter('related_cases ?= {:id}', { id }),
					...list(record.related_cases).map((relatedId) =>
						pb.filter('id = {:id}', { id: relatedId })
					)
				].join(' || ');
				try {
					const linked = await pb.collection('cases').getFullList<CaseRecord>({
						filter: `${pb.filter("published = true && status != 'archived' && id != {:id}", { id })} && (${relationFilter})`,
						sort: 'decision_date,created'
					});
					if (generation === loadGeneration) relatedCases = linked;
				} catch {
					if (generation === loadGeneration) relatedError = 'Related cases could not be loaded.';
				}
			}
		} catch (err) {
			if (generation !== loadGeneration) return;
			console.error('Error loading case:', err);
			error = 'Could not load this case.';
		} finally {
			if (generation === loadGeneration) loading = false;
		}
	}

	$effect(() => {
		const id = page.params.id;
		if (id) void loadCase(id);
	});
</script>

<svelte:head>
	<title>{record ? `${record.title} | DSA Case Law Tracker` : 'Case | DSA Case Law Tracker'}</title>
	<meta name="description" content={record ? stripHtml(record.summary) : 'DSA case record'} />
</svelte:head>

<!-- eslint-disable svelte/no-at-html-tags, svelte/no-navigation-without-resolve -->
<main class="mx-auto max-w-7xl bg-base-200/60 px-4 pb-16 sm:px-6 lg:px-8">
	<div use:reveal class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<button class="btn btn-ghost btn-sm" type="button" onclick={() => goto(resolve('/cases'))}>
			<IconArrowLeft class="size-4" aria-hidden="true" />
			Back to cases
		</button>
		{#if canWrite && record}
			<a
				class="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
				href={resolve(`/cases/${record.id}/edit`)}
				><IconPencil class="size-3.5" aria-hidden="true" />Edit case</a
			>
		{/if}
	</div>

	{#if loading}
		<div class="rounded-xl border border-slate-200 bg-white p-8 text-slate-500">
			Loading case...
		</div>
	{:else if error}
		<div class="rounded-xl border border-red-200 bg-red-50 p-8 text-red-700">{error}</div>
	{:else if record}
		<section
			use:reveal
			class="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/40 sm:p-8"
		>
			<div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
				<div class="min-w-0 flex-1">
					{#if categories.length}
						<div class="mb-3 flex flex-wrap gap-2">
							{#each [...new Set(categories)] as category (category)}
								<span
									class={`rounded-full px-2.5 py-1 text-xs font-semibold ${categoryStyle(category)}`}
									>{category}</span
								>
							{/each}
						</div>
					{/if}
					<h1 class="text-2xl leading-snug font-bold tracking-tight text-slate-950 sm:text-3xl">
						{record.title}
					</h1>
					<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-500">
						{#if record.jurisdiction}<span class="inline-flex items-center gap-1.5"
								><CountryFlag country={record.jurisdiction} />{record.jurisdiction}</span
							>{/if}
						{#if record.court}<span class="inline-flex items-center gap-1.5"
								><IconMapPin class="size-3.5 shrink-0" aria-hidden="true" />{record.court}</span
							>{/if}
					</div>
					{#if list(record.dsa_articles).length}
						<div class="mt-4 flex flex-wrap gap-1.5">
							{#each [...new Set(list(record.dsa_articles))] as article (article)}<a
									class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
									href={`${resolve('/cases')}?provision=${encodeURIComponent(article)}`}
									>{article}</a
								>{/each}
						</div>
					{/if}
					<div class="mt-4 flex flex-wrap gap-2 text-sm">
						{#if authStore.isAdmin && !record.published}
							<span class="rounded-full bg-slate-100 px-3 py-1 font-medium"> Private </span>
						{/if}
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
				<aside
					class="w-full shrink-0 rounded-xl border border-slate-200/80 bg-slate-50/70 p-5 lg:w-80"
					aria-label="Case reference"
				>
					<dl class="space-y-4">
						{#if record.decision_reference}
							<div>
								<dt class="text-sm font-medium text-slate-600">Decision reference</dt>
								<dd class="mt-1 text-base leading-6 break-words text-slate-950">
									{record.decision_reference}
								</dd>
							</div>
						{/if}
						{#if record.ecli}
							<div>
								<dt class="text-sm font-medium text-slate-600">ECLI</dt>
								<dd class="mt-1 text-base leading-6 break-all text-slate-950">{record.ecli}</dd>
							</div>
						{/if}
						{#if record.decision_date}
							<div>
								<dt class="text-sm font-medium text-slate-600">
									{record.decision_reference ? 'Reference date' : 'Decision date'}
								</dt>
								<dd class="mt-1 text-base font-semibold text-slate-950">
									{formatDate(record.decision_date)}
								</dd>
							</div>
						{/if}
						<div class="border-t border-slate-200 pt-4">
							<dt class="text-sm font-medium text-slate-600">Last updated</dt>
							<dd class="mt-1 text-base text-slate-950">{formatDate(record.updated)}</dd>
						</div>
					</dl>
				</aside>
			</div>
		</section>

		<div class="case-content mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
			<div class="min-w-0 space-y-6">
				<section use:reveal={100} class="rounded-xl border border-slate-200 bg-white p-6">
					<h2 class="text-xl font-bold">Summary and Analysis</h2>
					<div class="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
						<h3 class="font-semibold">Summary</h3>
						{#if stripHtml(record.summary)}<div class="prose mt-3 max-w-none text-slate-700">
								{@html linkifyHtml(record.summary)}
							</div>{:else}<p class="mt-3 text-slate-500">No summary has been added yet.</p>{/if}
					</div>
					<div class="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
						<h3 class="font-semibold">Analysis</h3>
						{#if stripHtml(record.commentary)}
							<div class="prose mt-3 max-w-none text-slate-700">
								{@html linkifyHtml(record.commentary)}
							</div>
						{:else}
							<p class="mt-3 text-sm leading-6 text-slate-600">
								There is no analysis on file yet. You are welcome to contribute by pitching a case
								commentary to the <a
									class="underline underline-offset-2 hover:text-slate-950"
									href="https://dsa-observatory.eu/blogposts-submission/"
									target="_blank"
									rel="noreferrer">DSA Observatory blog</a
								>.
							</p>
						{/if}
					</div>
				</section>

				<section use:reveal={160} class="rounded-xl border border-slate-200 bg-white p-6">
					<h2 class="text-xl font-bold">Related cases</h2>
					{#if relatedError}
						<p class="mt-4 text-sm text-red-700" role="alert">{relatedError}</p>
					{:else if relatedCases.length}
						<div class="mt-4 space-y-3">
							{#each relatedCases as related (related.id)}
								<a
									class="block rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
									href={resolve('/cases/[id]', { id: related.id })}
								>
									<p class="font-semibold text-slate-950">{related.title}</p>
									<p class="mt-1 text-sm text-slate-500">
										{related.jurisdiction}
										{formatDate(related.decision_date)}
									</p>
								</a>
							{/each}
						</div>
					{:else}
						<p class="mt-4 text-slate-500">No related cases have been linked yet.</p>
					{/if}
				</section>

				<section use:reveal={100} class="rounded-xl border border-slate-200 bg-white p-6">
					<h2 class="text-xl font-bold">Documents</h2>
					{#if documentFiles.length || sources.length}
						{#if documentFiles.length}
							<div class="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
								<h3 class="font-semibold">Uploaded documents</h3>
								<ul class="mt-2 space-y-2 text-sm text-slate-600">
									{#each documentFiles as filename (filename)}
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
						{#if sources.length}<div class="mt-4"><CaseSourceList {sources} /></div>{/if}
					{:else}
						<p class="mt-4 text-slate-500">No documents have been added yet.</p>
					{/if}
					{#if record.source_limitations}<div
							class="prose mt-5 max-w-none rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
						>
							{@html record.source_limitations}
						</div>{/if}
				</section>

				<section use:reveal={100} class="rounded-xl border border-slate-200 bg-white p-6">
					<h2 class="text-lg font-bold">Help improve this case</h2>
					<p class="mt-3 text-sm leading-6 text-slate-600">
						Would you like to edit or add something to this case?
					</p>
					<a
						class="btn mt-4 btn-outline btn-sm"
						href={`${resolve('/feedback')}?case=${encodeURIComponent(record.id)}`}
						>Make a suggestion</a
					>
				</section>
			</div>

			<aside class="min-w-0 space-y-6">
				<section use:reveal={240} class="rounded-xl border border-slate-200 bg-white p-5">
					<h2 class="font-bold">Relevant provisions</h2>
					<h3 class="mt-4 text-sm font-semibold">Provisions cited</h3>
					<div class="mt-4 flex flex-wrap gap-2">
						{#each provisions as provision (provision)}
							<a
								class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200"
								href={`${resolve('/cases')}?provision=${encodeURIComponent(provision)}`}
								>{provision}</a
							>
						{/each}
						{#if !provisions.length}<p class="text-sm text-slate-500">None recorded.</p>{/if}
					</div>
					<h3 class="mt-6 text-sm font-semibold">Category</h3>
					<div class="mt-3 flex flex-wrap gap-2">
						{#each [...new Set(categories)] as category (category)}
							<span
								class={`rounded-full px-3 py-1 text-xs font-semibold ${categoryStyle(category)}`}
								>{category}</span
							>
						{/each}
						{#if !categories.length}<p class="text-sm text-slate-500">None recorded.</p>{/if}
					</div>
				</section>
			</aside>
		</div>
	{/if}
</main>

<!-- eslint-enable svelte/no-at-html-tags, svelte/no-navigation-without-resolve -->

<style>
	.case-content {
		overflow-wrap: anywhere;
	}
	.case-content :global(img),
	.case-content :global(table) {
		max-width: 100%;
	}
	@media (prefers-reduced-motion: no-preference) {
		:global(.case-entry) {
			opacity: 0;
			transform: translateY(20px);
		}
		:global(.case-entry.case-entered) {
			animation: case-enter 0.75s var(--entry-delay, 0ms) cubic-bezier(0.16, 1, 0.3, 1) both;
		}
		:global(.case-entry:focus-within) {
			opacity: 1;
			transform: none;
			animation: none;
		}
	}
	@keyframes case-enter {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
