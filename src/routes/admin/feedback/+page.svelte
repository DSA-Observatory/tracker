<script lang="ts">
	import AdminPanelLayout from '$lib/components/admin/AdminPanelLayout.svelte';
	import { authStore, pb } from '$lib/database';
	import { onMount } from 'svelte';

	type FeedbackRecord = {
		id: string;
		message: string;
		contact?: string;
		created: string;
		resolved: boolean;
	};

	let feedback = $state<FeedbackRecord[]>([]);
	let loading = $state(true);
	let error = $state('');
	let activeTab = $state<'open' | 'resolved'>('open');
	let savingId = $state<string | null>(null);
	const canReview = $derived(authStore.isAdmin);

	function formatDate(value: string) {
		return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
	}

	async function loadFeedback() {
		if (!canReview) {
			loading = false;
			return;
		}
		loading = true;
		error = '';
		try {
			feedback = await pb.collection('website_feedback').getFullList<FeedbackRecord>({
				filter: activeTab === 'open' ? 'resolved = false' : 'resolved = true',
				sort: '-created'
			});
		} catch (err) {
			console.error('Error loading website feedback:', err);
			error = 'Could not load website feedback.';
		} finally {
			loading = false;
		}
	}

	async function setActiveTab(tab: 'open' | 'resolved') {
		if (activeTab === tab) return;
		activeTab = tab;
		await loadFeedback();
	}

	async function setResolved(item: FeedbackRecord, resolved: boolean) {
		if (!canReview || savingId) return;
		savingId = item.id;
		error = '';
		try {
			await pb.collection('website_feedback').update(item.id, { resolved });
			feedback = feedback.filter((entry) => entry.id !== item.id);
		} catch (err) {
			console.error('Error updating website feedback:', err);
			error = resolved ? 'Could not mark this feedback as resolved.' : 'Could not reopen this feedback.';
		} finally {
			savingId = null;
		}
	}

	onMount(() => {
		loadFeedback();
		if (!canReview) return;
		pb.collection('website_feedback').subscribe('*', loadFeedback).catch((err) => {
			console.error('Error subscribing to website feedback:', err);
		});
		return () => { pb.collection('website_feedback').unsubscribe('*'); };
	});
</script>

<svelte:head>
	<title>Website Feedback | DSA Case Law Tracker</title>
	<meta name="description" content="Review private website feedback." />
</svelte:head>

<AdminPanelLayout>
	<section class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<p class="text-sm font-semibold tracking-[0.24em] text-slate-400 uppercase">Private inbox</p>
				<h1 class="mt-3 text-4xl font-black tracking-tight text-slate-950">Website feedback</h1>
				<p class="mt-3 text-slate-600">Bug reports and improvement suggestions submitted through the website.</p>
			</div>
			{#if canReview}<button class="btn btn-outline" type="button" onclick={loadFeedback}>Refresh</button>{/if}
		</div>

		{#if !canReview}
			<div class="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">This page is only available to administrators.</div>
		{:else}
			<div class="mt-8 flex flex-wrap gap-2" role="group" aria-label="Feedback status">
				<button
					class={activeTab === 'open' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
					type="button"
					aria-pressed={activeTab === 'open'}
					onclick={() => setActiveTab('open')}>Open</button
				>
				<button
					class={activeTab === 'resolved' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
					type="button"
					aria-pressed={activeTab === 'resolved'}
					onclick={() => setActiveTab('resolved')}>Resolved</button
				>
			</div>

			{#if error}
				<div role="alert" class="mt-4 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>
			{/if}

			{#if loading}
			<p class="mt-8 text-slate-500">Loading feedback…</p>
		{:else if !feedback.length}
			<p class="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-500"
				>{activeTab === 'open' ? 'No open website feedback.' : 'No resolved website feedback.'}</p
			>
		{:else}
			<div class="mt-8 space-y-3">
				{#each feedback as item (item.id)}
					<article class="rounded-xl border border-slate-200 p-5">
						<div class="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
							<time datetime={item.created}>{formatDate(item.created)}</time>
							{#if item.contact}<a class="font-medium text-slate-700 underline-offset-4 hover:underline" href={`mailto:${item.contact}`}>{item.contact}</a>{/if}
						</div>
						<p class="mt-4 whitespace-pre-wrap leading-7 text-slate-900">{item.message}</p>
						<div class="mt-5 flex justify-end">
							<button
								class="btn btn-sm btn-outline"
								type="button"
								disabled={savingId !== null}
								onclick={() => setResolved(item, !item.resolved)}
							>
								{#if savingId === item.id}
									Saving…
								{:else if item.resolved}
									Reopen
								{:else}
									Mark resolved
								{/if}
							</button>
						</div>
					</article>
				{/each}
			</div>
		{/if}
		{/if}
	</section>
</AdminPanelLayout>
