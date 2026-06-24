<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AdminPanelLayout from '$lib/components/admin/AdminPanelLayout.svelte';
	import { authStore, pb, type CaseSubmissionRecord, type CaseSubmissionStatus } from '$lib/database';
	import { onMount } from 'svelte';

	let submission = $state<CaseSubmissionRecord>();
	let loading = $state(true);
	let error = $state('');
	let saving = $state(false);

	const canReview = $derived(authStore.isAuthenticated);

	function formatDate(value?: string) {
		return value
			? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
			: '';
	}

	function list(values?: string[]) {
		return Array.isArray(values) ? values.filter(Boolean) : [];
	}

	function stripHtml(value?: string) {
		return (value ?? '')
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function sourceLinks(item?: CaseSubmissionRecord) {
		if (!item) return [];
		return [...list(item.document_links), item.case_url].filter(Boolean) as string[];
	}

	function sourceLabel(url: string) {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	}

	async function loadSubmission() {
		if (!canReview) {
			loading = false;
			return;
		}

		loading = true;
		error = '';

		try {
			const id = page.params.id;
			if (!id) throw new Error('Missing submission id.');
			submission = await pb.collection('case_submissions').getOne<CaseSubmissionRecord>(id);
		} catch (err) {
			console.error('Error loading submission:', err);
			error = 'Could not load this suggested case.';
		} finally {
			loading = false;
		}
	}

	async function updateStatus(status: CaseSubmissionStatus) {
		if (!submission) return;

		saving = true;
		error = '';

		try {
			submission = await pb.collection('case_submissions').update<CaseSubmissionRecord>(submission.id, {
				status
			});
		} catch (err) {
			console.error('Error updating submission:', err);
			error = 'Could not update this submission.';
		} finally {
			saving = false;
		}
	}

	onMount(loadSubmission);
</script>

<svelte:head>
	<title>{submission ? `${submission.title} | Suggested Case` : 'Suggested Case'} | Admin</title>
	<meta name="description" content="Review a suggested DSA case." />
</svelte:head>

<AdminPanelLayout>
	<section class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
		<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
			<button class="btn btn-ghost btn-sm" type="button" onclick={() => goto(resolve('/admin/submissions'))}>
				Back to suggested cases
			</button>
		</div>

		{#if !canReview}
			<div class="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
				Sign in to review submissions.
			</div>
		{:else if loading}
			<div class="text-slate-500">Loading suggested case...</div>
		{:else if error}
			<div class="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>
		{:else if submission}
			<section class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
				<p class="text-xs font-semibold tracking-[0.24em] text-slate-400 uppercase">Suggested case</p>
				<h1 class="mt-3 text-3xl leading-tight font-black tracking-tight text-slate-950 md:text-5xl">
					{submission.title}
				</h1>
				<div class="mt-4 flex flex-wrap gap-2 text-sm">
					<span class="rounded-full bg-slate-950 px-3 py-1 font-medium text-white capitalize">
						{submission.status}
					</span>
					{#if submission.case_status}<span class="rounded-full bg-slate-100 px-3 py-1 font-medium capitalize">Case: {submission.case_status}</span>{/if}
					{#if submission.outcome}<span class="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">{submission.outcome}</span>{/if}
					{#if submission.case_scope}<span class="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700">{submission.case_scope}</span>{/if}
				</div>
				<p class="mt-4 text-sm text-slate-500">Submitted {formatDate(submission.created)}</p>
			</section>

			<div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
				<div class="space-y-6">
					<section class="rounded-2xl border border-slate-200 bg-white p-6">
						<h2 class="text-xl font-black">Summary</h2>
						{#if submission.summary}<div class="prose mt-4 max-w-none text-slate-700">{@html submission.summary}</div>{:else}<p class="mt-4 text-slate-500">No summary was submitted.</p>{/if}
					</section>

					<section class="rounded-2xl border border-slate-200 bg-white p-6">
						<h2 class="text-xl font-black">Procedural Timeline</h2>
						{#if list(submission.procedural_events?.map((event) => [event.date, event.label, event.description].filter(Boolean).join(' | '))).length}
							<ol class="mt-4 space-y-3">
								{#each submission.procedural_events ?? [] as event}
									<li class="rounded-xl border border-slate-100 bg-slate-50 p-4">
										{#if event.date}<div class="text-xs font-semibold text-slate-400">{event.date}</div>{/if}
										<div class="font-semibold text-slate-950">{event.label || 'Procedural event'}</div>
										{#if event.description}<p class="mt-1 text-sm text-slate-600">{event.description}</p>{/if}
									</li>
								{/each}
							</ol>
						{:else if stripHtml(submission.timeline)}
							<p class="mt-4 text-slate-700">{stripHtml(submission.timeline)}</p>
						{:else}
							<p class="mt-4 text-slate-500">No timeline was submitted.</p>
						{/if}
					</section>

					<section class="rounded-2xl border border-slate-200 bg-white p-6">
						<h2 class="text-xl font-black">Documents & References</h2>
						<div class="mt-4 grid gap-4 md:grid-cols-2">
							<div>
								<h3 class="font-semibold">Primary sources</h3>
								<ul class="mt-2 space-y-2 text-sm text-slate-600">
									{#each list(submission.primary_sources) as source}<li>{source}</li>{/each}
									{#if !list(submission.primary_sources).length}<li>None submitted</li>{/if}
								</ul>
							</div>
							<div>
								<h3 class="font-semibold">Secondary sources</h3>
								<ul class="mt-2 space-y-2 text-sm text-slate-600">
									{#each list(submission.secondary_sources) as source}<li>{source}</li>{/each}
									{#if !list(submission.secondary_sources).length}<li>None submitted</li>{/if}
								</ul>
							</div>
						</div>
						{#if sourceLinks(submission).length}
							<div class="mt-5 flex flex-wrap gap-2">
								{#each sourceLinks(submission) as link}
									<a class="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50" href={link} target="_blank" rel="noreferrer">{sourceLabel(link)}</a>
								{/each}
							</div>
						{/if}
						{#if submission.source_limitations}<div class="prose mt-5 max-w-none rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{@html submission.source_limitations}</div>{/if}
					</section>
				</div>

				<aside class="space-y-6">
					<section class="rounded-2xl border border-slate-200 bg-white p-5">
						<h2 class="font-black">Review status</h2>
						<div class="mt-4 flex flex-wrap gap-2">
							{#each ['review', 'accepted', 'rejected', 'archived'] as status}
								<button class="btn btn-sm" type="button" disabled={saving || submission.status === status} onclick={() => updateStatus(status as CaseSubmissionStatus)}>{status}</button>
							{/each}
						</div>
					</section>

					<section class="rounded-2xl border border-slate-200 bg-white p-5">
						<h2 class="font-black">At a glance</h2>
						<dl class="mt-4 space-y-3 text-sm">
							{#each [['Case ID', submission.case_id], ['ECLI', submission.ecli], ['Jurisdiction', submission.jurisdiction], ['Court', list(submission.courts).join(', ') || submission.court], ['Filing date', submission.filing_date], ['Decision date', submission.decision_date], ['Plaintiffs', list(submission.plaintiffs).join(', ')], ['Defendants', list(submission.defendants).join(', ')]] as item}
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
							{#each [...list(submission.dsa_articles), ...list(submission.legal_areas), ...list(submission.legal_basis), ...list(submission.categories), ...list(submission.themes), ...list(submission.keywords)] as tag}
								<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{tag}</span>
							{/each}
							{#if ![...list(submission.dsa_articles), ...list(submission.legal_areas), ...list(submission.legal_basis), ...list(submission.categories), ...list(submission.themes), ...list(submission.keywords)].length}
								<p class="text-sm text-slate-500">No tags submitted.</p>
							{/if}
						</div>
					</section>

					<section class="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
						<h2 class="font-black text-slate-950">Submitter</h2>
						<p class="mt-3">{submission.submitter_name || 'Unknown'}</p>
						{#if submission.submitter_email}<p class="mt-1 break-all">{submission.submitter_email}</p>{/if}
					</section>
				</aside>
			</div>
		{/if}
	</section>
</AdminPanelLayout>
