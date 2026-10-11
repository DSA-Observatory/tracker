<script lang="ts">
	import { resolve } from '$app/paths';
	import AdminPanelLayout from '$lib/components/admin/AdminPanelLayout.svelte';
	import CasesTable from '$lib/components/CasesTable.svelte';
	import { authStore, pb, type CaseSubmissionRecord } from '$lib/database';
	import { onMount } from 'svelte';

	let acceptedSubmissions = $state<CaseSubmissionRecord[]>([]);
	let submissionsLoading = $state(true);
	let submissionsError = $state('');
	let loadGeneration = 0;
	let disposed = false;

	async function loadAcceptedDrafts() {
		const generation = ++loadGeneration;
		if (!authStore.isAdmin) {
			if (!disposed && generation === loadGeneration) submissionsLoading = false;
			return;
		}

		submissionsLoading = true;
		submissionsError = '';
		try {
			const submissions = await pb
				.collection('case_submissions')
				.getFullList<CaseSubmissionRecord>({
					filter: "status = 'accepted' && resulting_case != ''",
					sort: '-updated',
					expand: 'resulting_case'
				});
			if (disposed || generation !== loadGeneration || !authStore.isAdmin) return;
			acceptedSubmissions = submissions.filter(
				(submission) =>
					submission.expand?.resulting_case?.status === 'draft' &&
					!submission.expand.resulting_case.published
			);
		} catch (err) {
			if (disposed || generation !== loadGeneration) return;
			console.error('Error loading accepted draft suggestions:', err);
			submissionsError = 'Could not load suggested-case return options.';
		} finally {
			if (!disposed && generation === loadGeneration) submissionsLoading = false;
		}
	}

	onMount(() => {
		disposed = false;
		void loadAcceptedDrafts();
		return () => {
			disposed = true;
			loadGeneration += 1;
		};
	});
</script>

<svelte:head>
	<title>Draft Cases | DSA Case Law Tracker</title>
	<meta name="description" content="Review unpublished DSA case records." />
</svelte:head>

<AdminPanelLayout>
	{#if !authStore.isAuthenticated}
		<div class="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
			Sign in to review draft cases.
		</div>
	{:else if !authStore.isAdmin}
		<div class="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
			This page is only available to administrators.
		</div>
	{:else}
		{#if submissionsError}
			<div class="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
				{submissionsError}
			</div>
		{:else if !submissionsLoading && acceptedSubmissions.length}
			<section class="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
				<h2 class="text-lg font-bold text-slate-950">Return a suggested case to review</h2>
				<p class="mt-1 text-sm text-slate-600">
					These drafts came from accepted suggestions. Open the suggestion to return its unpublished
					draft to the review queue without deleting the linked record.
				</p>
				<ul class="mt-4 space-y-2">
					{#each acceptedSubmissions as submission (submission.id)}
						<li
							class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3"
						>
							<span class="min-w-0 font-medium break-words text-slate-900">{submission.title}</span>
							<a
								class="btn btn-outline btn-sm"
								href={resolve('/admin/submissions/[id]', { id: submission.id })}
								>Review return options</a
							>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
		<div class="min-h-[38rem] rounded-[2rem] border border-slate-200 bg-white py-5 shadow-sm">
			<CasesTable
				publicationFilter="draft"
				heading="Draft cases"
				description="Review active unpublished records before publication."
			/>
		</div>
	{/if}
</AdminPanelLayout>
