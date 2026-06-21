<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import {
		authStore,
		pb,
		type CaseSubmissionRecord,
		type CaseSubmissionStatus
	} from '$lib/database';

	let submissions = $state<CaseSubmissionRecord[]>([]);
	let loading = $state(true);
	let error = $state('');
	let savingId = $state('');

	const canReview = $derived(authStore.isAuthenticated);

	function formatDate(value?: string) {
		return value
			? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
			: '';
	}

	async function loadSubmissions() {
		if (!canReview) {
			loading = false;
			return;
		}

		loading = true;
		error = '';

		try {
			submissions = await pb.collection('case_submissions').getFullList<CaseSubmissionRecord>({
				sort: '-created'
			});
		} catch (err) {
			console.error('Error loading submissions:', err);
			error = 'Could not load case submissions.';
		} finally {
			loading = false;
		}
	}

	async function updateStatus(submission: CaseSubmissionRecord, status: CaseSubmissionStatus) {
		savingId = submission.id;
		error = '';

		try {
			const updated = await pb
				.collection('case_submissions')
				.update<CaseSubmissionRecord>(submission.id, { status });
			submissions = submissions.map((item) => (item.id === updated.id ? updated : item));
		} catch (err) {
			console.error('Error updating submission:', err);
			error = 'Could not update this submission.';
		} finally {
			savingId = '';
		}
	}

	onMount(loadSubmissions);
</script>

<svelte:head>
	<title>Case Submissions | DSA Case Law Tracker</title>
	<meta name="description" content="Review submitted DSA case leads." />
</svelte:head>

<main class="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
	<section class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<p class="text-sm font-semibold tracking-[0.24em] text-slate-400 uppercase">
					Editorial queue
				</p>
				<h1 class="mt-3 text-4xl font-black tracking-tight text-slate-950">Case submissions</h1>
				<p class="mt-3 max-w-2xl text-slate-600">
					Review community case leads before creating or updating public case records.
				</p>
			</div>
			{#if canReview}<button class="btn btn-outline" type="button" onclick={loadSubmissions}
					>Refresh</button
				>{/if}
		</div>

		{#if !canReview}
			<div class="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
				Sign in to review submissions.
			</div>
		{:else if error}
			<div class="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>
		{:else if loading}
			<div class="mt-8 text-slate-500">Loading submissions...</div>
		{:else if !submissions.length}
			<div class="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-500">
				No submissions yet.
			</div>
		{:else}
			<div class="mt-8 space-y-4">
				{#each submissions as submission}
					<article class="rounded-2xl border border-slate-200 p-5">
						<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<span
										class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 capitalize"
										>{submission.status}</span
									>
									<span class="text-xs text-slate-400"
										>Submitted {formatDate(submission.created)}</span
									>
								</div>
								<h2 class="mt-3 text-xl font-black text-slate-950">{submission.title}</h2>
								<div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
									{#if submission.jurisdiction}<span>{submission.jurisdiction}</span>{/if}
									{#if submission.court}<span>{submission.court}</span>{/if}
									{#if submission.parties}<span>{submission.parties}</span>{/if}
								</div>
								{#if submission.summary}<div class="prose mt-4 max-w-none text-sm text-slate-700">
										{@html submission.summary}
									</div>{/if}
								{#if submission.case_url}<a
										class="mt-4 inline-flex text-sm font-semibold text-slate-700 underline"
										href={submission.case_url}
										target="_blank"
										rel="noreferrer">Open source</a
									>{/if}
								{#if submission.submitter_name || submission.submitter_email}
									<p class="mt-3 text-xs text-slate-400">
										Submitted by {submission.submitter_name || 'Unknown'}
										{submission.submitter_email ? `(${submission.submitter_email})` : ''}
									</p>
								{/if}
							</div>
							<div class="flex shrink-0 flex-wrap gap-2">
								<a class="btn btn-outline btn-sm" href={resolve('/cases/new')}>Create case</a>
								{#each ['review', 'accepted', 'rejected', 'archived'] as status}
									<button
										class="btn btn-sm"
										type="button"
										disabled={savingId === submission.id || submission.status === status}
										onclick={() => updateStatus(submission, status as CaseSubmissionStatus)}
										>{status}</button
									>
								{/each}
							</div>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	</section>
</main>
