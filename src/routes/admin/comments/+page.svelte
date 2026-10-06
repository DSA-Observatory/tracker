<script lang="ts">
	import { resolve } from '$app/paths';
	import AdminPanelLayout from '$lib/components/admin/AdminPanelLayout.svelte';
	import { authStore, pb } from '$lib/database';
	import { groupOpenComments, type CaseCommentRecord } from '$lib/comments';
	import { onMount } from 'svelte';
	import IconMessageSquare from '~icons/lucide/message-square';

	let comments = $state<CaseCommentRecord[]>([]);
	let loading = $state(true);
	let error = $state('');
	let queueFilter = $state<'all' | 'assigned'>('all');
	const groups = $derived(groupOpenComments(comments));
	const visibleGroups = $derived(
		queueFilter === 'assigned'
			? groupOpenComments(comments.filter((comment) => comment.assignee === authStore.user?.id))
			: groups
	);

	function formatDate(value: string) {
		return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
			new Date(value)
		);
	}

	async function loadComments() {
		if (!authStore.isAdmin) {
			loading = false;
			return;
		}

		loading = true;
		error = '';
		try {
			comments = await pb.collection('case_comments').getFullList<CaseCommentRecord>({
				filter: 'resolved = false',
				sort: '-created',
				expand: 'case,submission,author,assignee'
			});
		} catch (err) {
			console.error('Error loading comment queue:', err);
			error = 'Could not load comments.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadComments();
		if (!authStore.isAdmin) return;

		pb.collection('case_comments')
			.subscribe('*', loadComments)
			.catch((err) => {
				console.error('Error subscribing to comment queue:', err);
			});
		return () => {
			pb.collection('case_comments').unsubscribe('*');
		};
	});
</script>

<svelte:head>
	<title>Editorial Comments | DSA Case Law Tracker</title>
	<meta name="description" content="Review unresolved editorial comments." />
</svelte:head>

<AdminPanelLayout>
	<section class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<p class="text-sm font-semibold tracking-[0.24em] text-slate-400 uppercase">
					Editorial queue
				</p>
				<h1 class="mt-3 text-4xl font-black tracking-tight text-slate-950">Editorial comments</h1>
				<p class="mt-3 max-w-2xl text-slate-600">
					Review and resolve outstanding editorial comments on cases and suggested cases.
				</p>
			</div>
			{#if authStore.isAdmin}<button class="btn btn-outline" type="button" onclick={loadComments}
					>Refresh</button
				>{/if}
		</div>

		{#if !authStore.isAuthenticated}
			<div class="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
				Sign in to review comments.
			</div>
		{:else if !authStore.isAdmin}
			<div class="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
				This page is only available to administrators.
			</div>
		{:else if error}
			<div class="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>
		{:else if loading}
			<div class="mt-8 text-slate-500">Loading comments...</div>
		{:else if !groups.length}
			<div class="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
				No unresolved comments.
			</div>
		{:else}
			<div class="mt-8 flex flex-wrap gap-2" aria-label="Filter comment queue">
				<button
					type="button"
					class={queueFilter === 'all' ? 'btn btn-sm btn-neutral' : 'btn btn-outline btn-sm'}
					aria-pressed={queueFilter === 'all'}
					onclick={() => (queueFilter = 'all')}>All open</button
				>
				<button
					type="button"
					class={queueFilter === 'assigned' ? 'btn btn-sm btn-neutral' : 'btn btn-outline btn-sm'}
					aria-pressed={queueFilter === 'assigned'}
					onclick={() => (queueFilter = 'assigned')}>Assigned to me</button
				>
			</div>
			{#if !visibleGroups.length}
				<div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
					No unresolved comments assigned to you.
				</div>
			{:else}
			<div class="mt-8 space-y-4">
				{#each visibleGroups as group (`${group.targetType}:${group.target.id}`)}
					<article class="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
						<div class="flex flex-wrap items-start justify-between gap-4">
							<div>
								<div class="flex items-center gap-2 text-sm text-slate-500">
									<IconMessageSquare class="size-4" />
									{group.comments.length} unresolved
								</div>
								<h2 class="mt-2 text-xl font-bold text-slate-950">{group.target.title}</h2>
								{#if group.targetType === 'case'}
									<p class="mt-1 font-mono text-xs text-slate-500">{group.target.case_id}</p>
								{:else}
									<p class="mt-1 text-xs text-slate-500">Suggested case</p>
								{/if}
							</div>
							<a
								class="btn btn-sm btn-primary"
								href={
									group.targetType === 'case'
										? resolve('/cases/[id]/edit', { id: group.target.id })
										: resolve('/admin/submissions/[id]', { id: group.target.id })
								}>{group.targetType === 'case' ? 'Open case' : 'Open suggested case'}</a
							>
						</div>
						<div class="mt-4 divide-y divide-slate-100 border-t border-slate-100">
							{#each group.comments as comment (comment.id)}
								<a
									class="block py-3 text-slate-700 transition hover:text-slate-950"
									href={
										group.targetType === 'case'
											? resolve(`/cases/${group.target.id}/edit?comment=${encodeURIComponent(comment.id)}`)
											: resolve(`/admin/submissions/${group.target.id}?comment=${encodeURIComponent(comment.id)}`)
									}
								>
									<p class="line-clamp-2 text-sm">{comment.content}</p>
									{#if comment.expand?.assignee}<p class="mt-1 text-xs text-slate-500"
											>Assigned to {comment.expand.assignee.name || comment.expand.assignee.username || comment.expand.assignee.email}</p
										>{/if}
									<time class="mt-1 block text-xs text-slate-400" datetime={comment.created}
										>{formatDate(comment.created)}</time
									>
								</a>
							{/each}
						</div>
					</article>
				{/each}
			</div>
			{/if}
		{/if}
	</section>
</AdminPanelLayout>
