<script lang="ts">
	import { resolve } from '$app/paths';
	import AdminPanelLayout from '$lib/components/admin/AdminPanelLayout.svelte';
	import { onMount } from 'svelte';
	import { authStore, pb, type CaseSubmissionRecord } from '$lib/database';
	import type { CaseCommentRecord } from '$lib/comments';

	let submissions = $state<CaseSubmissionRecord[]>([]);
	let loading = $state(true);
	let error = $state('');
	let comments = $state<CaseCommentRecord[]>([]);
	let statusFilter = $state<'pending' | 'accepted' | 'rejected'>('pending');

	const canReview = $derived(authStore.isAdmin);
	const filteredSubmissions = $derived(
		submissions.filter((submission) =>
			statusFilter === 'pending'
				? ['new', 'pending', 'review'].includes(submission.status)
				: submission.status === statusFilter
		)
	);

	function formatDate(value?: string) {
		return value
			? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
			: '';
	}

	function stripHtml(value?: string) {
		return (value ?? '')
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function sourceLabel(url?: string) {
		if (!url) return '';
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return url;
		}
	}

	function list(values?: string[]) {
		return Array.isArray(values) ? values.filter(Boolean) : [];
	}

	function partyText(submission: CaseSubmissionRecord) {
		const parties = [...list(submission.plaintiffs), ...list(submission.defendants)];
		return parties.length ? parties.join(', ') : submission.parties;
	}

	function sourceLinks(submission: CaseSubmissionRecord) {
		return [...list(submission.document_links), submission.case_url].filter(
			(value): value is string => {
				if (!value) return false;
				try {
					return ['http:', 'https:'].includes(new URL(value).protocol);
				} catch {
					return false;
				}
			}
		);
	}

	async function loadSubmissions() {
		if (!canReview) {
			loading = false;
			return;
		}

		loading = true;
		error = '';

		try {
			[submissions, comments] = await Promise.all([
				pb.collection('case_submissions').getFullList<CaseSubmissionRecord>({
					sort: '-created',
					expand: 'resulting_case,decided_by'
				}),
				pb.collection('case_comments').getFullList<CaseCommentRecord>({
					filter: "submission != ''",
					fields: 'id,submission,resolved'
				})
			]);
		} catch (err) {
			console.error('Error loading submissions:', err);
			error = 'Could not load case submissions.';
		} finally {
			loading = false;
		}
	}

	function sortSubmissions(items: CaseSubmissionRecord[]) {
		return [...items].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
	}

	function applyRealtimeSubmission(event: { action: string; record: CaseSubmissionRecord }) {
		if (event.action === 'create') {
			submissions = sortSubmissions([event.record, ...submissions]);
		} else if (event.action === 'update') {
			submissions = sortSubmissions(
				submissions.map((item) => (item.id === event.record.id ? event.record : item))
			);
		} else if (event.action === 'delete') {
			submissions = submissions.filter((item) => item.id !== event.record.id);
		}
	}

	function commentCounts(submissionId: string) {
		const matching = comments.filter((comment) => comment.submission === submissionId);
		return { total: matching.length, open: matching.filter((comment) => !comment.resolved).length };
	}

	onMount(() => {
		loadSubmissions();

		if (!canReview) return;

		pb.collection('case_submissions')
			.subscribe('*', applyRealtimeSubmission)
			.catch((err) => {
				console.error('Error subscribing to case submissions:', err);
			});
		pb.collection('case_comments')
			.subscribe('*', loadSubmissions)
			.catch((err) => {
				console.error('Error subscribing to suggestion comments:', err);
			});

		return () => {
			pb.collection('case_submissions').unsubscribe('*');
			pb.collection('case_comments').unsubscribe('*');
		};
	});
</script>

<svelte:head>
	<title>Case Submissions | DSA Case Law Tracker</title>
	<meta name="description" content="Review submitted DSA case leads." />
</svelte:head>

<AdminPanelLayout>
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
				This page is only available to administrators.
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
			<div class="mt-6 flex flex-wrap gap-2" aria-label="Filter suggested cases by status">
				{#each ['pending', 'accepted', 'rejected'] as filter}
					<button
						class={statusFilter === filter ? 'btn btn-sm btn-neutral' : 'btn btn-outline btn-sm'}
						type="button"
						onclick={() => (statusFilter = filter as typeof statusFilter)}
					>
						{filter}
					</button>
				{/each}
			</div>
			{#if !filteredSubmissions.length}
				<div class="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-500">
					No {statusFilter} submissions.
				</div>
			{:else}
				<div class="mt-8 space-y-2.5">
					{#each filteredSubmissions as submission}
						{@const links = sourceLinks(submission)}
						{@const parties = partyText(submission)}
						{@const commentCount = commentCounts(submission.id)}
						<article
							class="group rounded-sm border border-slate-200 bg-white p-4 shadow-xs shadow-slate-200/40 transition duration-200 hover:border-slate-300"
						>
							<div class="flex h-full flex-col gap-4">
								<div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
									<div class="min-w-0 flex-1">
										<div class="mb-2 flex flex-wrap items-center gap-2">
											<span
												class="rounded-sm border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-600 capitalize"
												>{submission.status}</span
											>
											<span class="text-xs text-slate-400"
												>Submitted {formatDate(submission.created)}</span
											>
										</div>
										<a
											class="line-clamp-2 text-lg leading-tight font-semibold tracking-tight text-slate-950 hover:text-slate-700 hover:underline"
											href={resolve('/admin/submissions/[id]', { id: submission.id })}
										>
											{submission.title}
										</a>
										<div
											class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500"
										>
											<span>{submission.jurisdiction || 'Jurisdiction not listed'}</span>
											<span class="text-slate-300" aria-hidden="true">/</span>
											<span>{submission.court || 'Court not listed'}</span>
											{#if submission.ecli}
												<span class="text-slate-300" aria-hidden="true">/</span>
												<span class="font-mono text-xs text-slate-500">{submission.ecli}</span>
											{/if}
										</div>
									</div>
									<div
										class="flex shrink-0 flex-wrap gap-2 opacity-100 transition lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
									>
										<a
											class="btn btn-outline btn-sm"
											href={resolve('/admin/submissions/[id]', { id: submission.id })}
										>
											Review
										</a>
										{#if submission.resulting_case}
											<a
												class="btn btn-sm btn-primary"
												href={resolve('/cases/[id]/edit', { id: submission.resulting_case })}
												>Open draft</a
											>
										{/if}
									</div>
								</div>

								<div
									class="grid gap-3 text-sm lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)]"
								>
									<section class="min-w-0 rounded-sm border border-slate-100 bg-slate-50/40 p-3">
										<div class="text-[0.72rem] font-medium text-slate-400">Suggestion status</div>
										<p class="mt-2 text-[0.95rem] text-slate-900 capitalize">{submission.status}</p>
										<p class="mt-1 text-xs text-slate-500">
											{commentCount.total} comment{commentCount.total === 1 ? '' : 's'}
											{#if commentCount.open}
												/ {commentCount.open} unresolved{/if}
										</p>
									</section>

									<section class="min-w-0 rounded-sm border border-slate-100 bg-white p-3">
										<div class="flex items-center justify-between gap-2">
											<div class="text-[0.72rem] font-medium text-slate-400">Sources</div>
											{#if links.length}
												<a
													class="text-xs font-medium text-slate-600 underline-offset-4 hover:text-slate-950 hover:underline"
													href={links[0]}
													target="_blank"
													rel="noreferrer">Open{links.length > 1 ? ` +${links.length - 1}` : ''}</a
												>
											{/if}
										</div>
										<p class="mt-2 line-clamp-1 text-[0.95rem] text-slate-900">
											{links.length ? sourceLabel(links[0]) : 'No source recorded'}
										</p>
									</section>

									<section class="min-w-0 rounded-sm border border-slate-100 bg-white p-3">
										<div class="text-[0.72rem] font-medium text-slate-400">Context</div>
										<div class="mt-2 space-y-1.5 text-[0.95rem] text-slate-900">
											{#if parties}
												<p class="line-clamp-1">
													<span class="text-xs font-normal text-slate-400">Parties</span>
													<span class="text-slate-200"> / </span>
													<span>{parties}</span>
												</p>
											{/if}
											{#if submission.summary}
												<p class="line-clamp-2">
													<span class="text-xs font-normal text-slate-400">Reason</span>
													<span class="text-slate-200"> / </span>
													<span>{stripHtml(submission.summary)}</span>
												</p>
											{:else if !parties}
												<p class="text-slate-500">No contextual metadata</p>
											{/if}
										</div>
									</section>
								</div>
							</div>
						</article>
					{/each}
				</div>
			{/if}
		{/if}
	</section>
</AdminPanelLayout>
