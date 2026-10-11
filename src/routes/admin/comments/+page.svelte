<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import AdminPanelLayout from '$lib/components/admin/AdminPanelLayout.svelte';
	import CaseCommentsPanel from '$lib/components/cases/CaseCommentsPanel.svelte';
	import { authStore, pb } from '$lib/database';
	import { groupOpenComments, isCommentAssignedTo, type CaseCommentRecord } from '$lib/comments';
	import { onMount } from 'svelte';
	import IconMessageSquare from '~icons/lucide/message-square';

	let comments = $state<CaseCommentRecord[]>([]);
	let loading = $state(true);
	let error = $state('');
	let queueFilter = $state<'all' | 'assigned'>('all');
	let loadGeneration = 0;
	let disposed = false;
	const groups = $derived(groupOpenComments(comments));
	const visibleGroups = $derived(
		queueFilter === 'assigned'
			? groupOpenComments(
					comments.filter((comment) => isCommentAssignedTo(comment, authStore.user?.id))
				)
			: groups
	);

	function formatDate(value: string) {
		return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
			new Date(value)
		);
	}

	async function loadComments() {
		const generation = ++loadGeneration;
		if (!authStore.isAdmin) {
			if (!disposed && generation === loadGeneration) {
				comments = [];
				loading = false;
			}
			return;
		}

		// Keep the composer mounted during queue refreshes so draft replies are not lost.
		error = '';
		try {
			const loaded = await pb.collection('case_comments').getFullList<CaseCommentRecord>({
				filter: 'resolved = false',
				sort: '-created',
				expand: 'case,submission,author,assignee'
			});
			if (disposed || generation !== loadGeneration || !authStore.isAdmin) return;
			comments = loaded;
		} catch (err) {
			if (disposed || generation !== loadGeneration) return;
			console.error('Error loading comment queue:', err);
			error = 'Could not load comments.';
		} finally {
			if (!disposed && generation === loadGeneration) loading = false;
		}
	}

	onMount(() => {
		disposed = false;
		void loadComments();
		if (!authStore.isAdmin) return;

		pb.collection('case_comments')
			.subscribe('*', () => void loadComments())
			.catch((err) => {
				console.error('Error subscribing to comment queue:', err);
			});
		return () => {
			disposed = true;
			loadGeneration += 1;
			pb.collection('case_comments').unsubscribe('*');
		};
	});
</script>

<svelte:head>
	<title>Editorial Comments | DSA Case Law Tracker</title>
	<meta name="description" content="Review unresolved editorial comments." />
</svelte:head>

<!-- eslint-disable svelte/no-navigation-without-resolve -- Queue links resolve their route in each conditional branch. -->
<AdminPanelLayout>
	<section class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<p class="text-sm font-semibold tracking-[0.24em] text-slate-400 uppercase">
					Editorial queue
				</p>
				<h1 class="mt-3 text-4xl font-black tracking-tight text-slate-950">Editorial comments</h1>
				<p class="mt-3 max-w-2xl text-slate-600">
					Review and resolve outstanding editorial comments on cases, suggested cases, and general
					work.
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
		{/if}
		{#if authStore.isAdmin && loading}
			<div class="mt-8 text-slate-500">Loading comments...</div>
		{:else if authStore.isAdmin}
			<section id="general-comments" class="mt-8 scroll-mt-24">
				<h2 class="text-xl font-bold text-slate-950">General comments</h2>
				<p class="mt-1 text-sm text-slate-600">
					Discuss editorial work that is not attached to a case or suggested case.
				</p>
				<div class="mt-4 max-w-2xl">
					<CaseCommentsPanel
						general
						selectedCommentId={page.url.searchParams.get('comment') ?? undefined}
						onCommentChange={loadComments}
					/>
				</div>
			</section>

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
			{#if !groups.length}
				<div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
					No unresolved comments.
				</div>
			{:else if !visibleGroups.length}
				<div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-6 text-slate-600">
					No unresolved comments assigned to you.
				</div>
			{:else}
				<div class="mt-8 space-y-4">
					{#each visibleGroups as group (`${group.targetType}:${group.target.id}`)}
						<article class="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
							<div class="flex items-start justify-between gap-4">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2 text-sm text-slate-500">
										<IconMessageSquare class="size-4" />
										{group.comments.length} unresolved
									</div>
									<h2 class="mt-2 text-xl font-medium break-words text-slate-950">
										{group.target.title}
									</h2>
									{#if group.targetType === 'submission'}
										<p class="mt-1 text-xs text-slate-500">Suggested case</p>
									{/if}
								</div>
								<a
									class="btn h-auto min-h-8 max-w-32 shrink-0 py-2 text-center btn-sm btn-primary sm:max-w-none"
									href={group.targetType === 'general'
										? resolve('/admin/comments')
										: group.targetType === 'case'
											? resolve('/cases/[id]/edit', { id: group.target.id })
											: resolve('/admin/submissions/[id]', { id: group.target.id })}
									>{group.targetType === 'general'
										? 'Open general comments'
										: group.targetType === 'case'
											? 'Open case'
											: 'Open suggested case'}</a
								>
							</div>
							<div class="mt-4 space-y-2">
								{#each group.comments as comment (comment.id)}
									<a
										class="block rounded-lg bg-yellow-50 p-4 text-slate-700 transition hover:bg-yellow-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
										href={group.targetType === 'general'
											? `${resolve('/admin/comments')}?comment=${encodeURIComponent(comment.id)}#general-comments`
											: group.targetType === 'case'
												? resolve(
														`/cases/${group.target.id}/edit?comment=${encodeURIComponent(comment.id)}`
													)
												: resolve(
														`/admin/submissions/${group.target.id}?comment=${encodeURIComponent(comment.id)}`
													)}
									>
										<div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
											<span class="font-semibold"
												>{comment.expand?.author?.name ||
													comment.expand?.author?.username ||
													comment.expand?.author?.email ||
													'Unknown author'}</span
											>
											<span aria-hidden="true">·</span>
											<time datetime={comment.created}>{formatDate(comment.created)}</time>
										</div>
										<p class="mt-2 line-clamp-2 text-sm font-medium break-words">
											{comment.content}
										</p>
										{#if comment.expand?.assignee}<p class="mt-1 text-xs text-slate-500">
												Assigned to {comment.expand.assignee.name ||
													comment.expand.assignee.username ||
													comment.expand.assignee.email}
											</p>{/if}
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
<!-- eslint-enable svelte/no-navigation-without-resolve -->
