<script lang="ts">
	import { authStore, pb } from '$lib/database';
	import type { CaseCommentRecord } from '$lib/comments';
	import AdminMentionComposer, { type AdminUser } from './AdminMentionComposer.svelte';
	import { onMount } from 'svelte';
	import IconCheck from '~icons/lucide/check';
	import IconMessageSquare from '~icons/lucide/message-square';
	import IconSend from '~icons/lucide/send';
	import IconPencil from '~icons/lucide/pencil';
	import IconTrash from '~icons/lucide/trash-2';

	let {
		caseId,
		submissionId,
		selectedCommentId
	}: { caseId?: string; submissionId?: string; selectedCommentId?: string } = $props();
	let comments = $state<CaseCommentRecord[]>([]);
	let content = $state('');
	let assigneeId = $state('');
	let admins = $state<AdminUser[]>([]);
	let adminError = $state('');
	let selectedId = $state(selectedCommentId ?? '');
	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');
	let editingId = $state('');
	let editContent = $state('');
	let editAssigneeId = $state('');
	let editAssigneeLabel = $state('');
	let deletingId = $state('');
	let loadGeneration = 0;
	const targetField = $derived(submissionId ? 'submission' : 'case');
	const targetId = $derived(submissionId ?? caseId ?? '');

	function authorName(comment: CaseCommentRecord) {
		const author = comment.expand?.author;
		return author?.name || author?.username || author?.email || 'Admin';
	}

	function assigneeName(comment: CaseCommentRecord) {
		const assignee = comment.expand?.assignee;
		return assignee?.name || assignee?.username || assignee?.email || 'Assigned admin';
	}

	function formatDate(value: string) {
		return new Intl.DateTimeFormat('en', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}

	async function loadComments(field = targetField, id = targetId) {
		const generation = ++loadGeneration;
		if (!authStore.isAdmin) {
			loading = false;
			return;
		}

		try {
			const loaded = await pb.collection('case_comments').getFullList<CaseCommentRecord>({
				filter: pb.filter(`${field} = {:targetId}`, { targetId: id }),
				sort: 'created',
				expand: 'author,resolved_by,assignee'
			});
			if (generation !== loadGeneration || field !== targetField || id !== targetId) return;
			comments = loaded;
		} catch (err) {
			if (generation !== loadGeneration || field !== targetField || id !== targetId) return;
			console.error('Error loading case comments:', err);
			error = 'Could not load comments.';
		} finally {
			if (generation === loadGeneration && field === targetField && id === targetId)
				loading = false;
		}
	}

	async function loadAdmins() {
		try {
			admins = await pb.collection('users').getFullList<AdminUser>({
				filter: 'is_admin = true',
				sort: 'name,email',
				fields: 'id,email,name'
			});
			adminError = '';
		} catch (err) {
			console.error('Error loading comment assignees:', err);
			adminError = 'Could not load administrators for assignment.';
		}
	}

	$effect(() => {
		const field = targetField;
		const id = targetId;
		if (!id || !authStore.isAdmin) return;
		selectedId = selectedCommentId ?? '';
		content = '';
		assigneeId = '';
		editingId = '';
		editContent = '';
		editAssigneeId = '';
		editAssigneeLabel = '';
		deletingId = '';
		error = '';
		comments = [];
		loading = true;
		loadComments(field, id);
	});

	async function addComment() {
		const message = content.trim();
		if (!message || !authStore.user?.id || saving) return;

		saving = true;
		error = '';
		try {
			const comment = await pb.collection('case_comments').create<CaseCommentRecord>({
				[targetField]: targetId,
				author: authStore.user.id,
				content: message,
				assignee: assigneeId,
				resolved: false
			});
			content = '';
			assigneeId = '';
			selectedId = comment.id;
			await loadComments();
		} catch (err) {
			console.error('Error adding case comment:', err);
			error = 'Could not send this comment.';
		} finally {
			saving = false;
		}
	}

	async function resolveComment(comment: CaseCommentRecord) {
		if (!authStore.user?.id || comment.resolved || saving) return;

		saving = true;
		error = '';
		try {
			await pb.collection('case_comments').update(comment.id, {
				resolved: true,
				resolved_by: authStore.user.id,
				resolved_at: new Date().toISOString()
			});
			await loadComments();
		} catch (err) {
			console.error('Error resolving case comment:', err);
			error = 'Could not resolve this comment.';
		} finally {
			saving = false;
		}
	}

	async function saveComment(comment: CaseCommentRecord) {
		const message = editContent.trim();
		if (!authStore.isAdmin || !message || saving) return;
		saving = true;
		error = '';
		try {
			await pb.collection('case_comments').update(comment.id, {
				content: message,
				assignee: editAssigneeId
			});
			editingId = '';
			editAssigneeId = '';
			editAssigneeLabel = '';
			await loadComments();
		} catch {
			error = 'Could not save this comment. Your edits have been kept.';
		} finally {
			saving = false;
		}
	}

	async function clearAssignee(comment: CaseCommentRecord) {
		if (!authStore.isAdmin || !comment.assignee || saving) return;
		saving = true;
		error = '';
		try {
			await pb.collection('case_comments').update(comment.id, { assignee: '' });
			await loadComments();
		} catch {
			error = 'Could not clear this assignment.';
		} finally {
			saving = false;
		}
	}

	async function deleteComment(comment: CaseCommentRecord) {
		if (!authStore.isAdmin || deletingId !== comment.id || saving) return;
		saving = true;
		error = '';
		try {
			await pb.collection('case_comments').delete(comment.id);
			if (selectedId === comment.id) selectedId = '';
			deletingId = '';
			await loadComments();
		} catch {
			error = 'Could not delete this comment.';
		} finally {
			saving = false;
		}
	}

	onMount(() => {
		if (!authStore.isAdmin) return;
		loadAdmins();

		pb.collection('case_comments')
			.subscribe('*', () => loadComments())
			.catch((err) => {
				console.error('Error subscribing to case comments:', err);
			});

		return () => {
			pb.collection('case_comments').unsubscribe('*');
		};
	});
</script>

{#if authStore.isAdmin}
	<aside
		class="flex min-h-[32rem] flex-col rounded-xl border border-base-300 bg-base-100 shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)]"
	>
		<header class="flex items-center justify-between border-b border-base-300 p-4">
			<div class="flex items-center gap-2">
				<IconMessageSquare class="size-5" />
				<h2 class="text-lg font-bold">Comments</h2>
			</div>
			<span class="badge badge-neutral"
				>{comments.filter((comment) => !comment.resolved).length} open</span
			>
		</header>

		<div class="flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
			{#if loading}
				<p class="p-2 text-sm text-base-content/60">Loading comments...</p>
			{:else if !comments.length}
				<p class="rounded-lg bg-base-200 p-4 text-sm text-base-content/65">No comments yet.</p>
			{:else}
				{#each comments as comment (comment.id)}
					{#if editingId === comment.id}
						<form
							class="rounded-lg border border-base-content/40 bg-base-100 p-3"
							onsubmit={(event) => {
								event.preventDefault();
								saveComment(comment);
							}}
						>
							<label class="mb-2 block text-xs font-semibold" for={`edit-comment-${comment.id}`}
								>Edit comment</label
							>
							<AdminMentionComposer
								id={`edit-comment-${comment.id}`}
								label="Edit comment"
								bind:content={editContent}
								bind:assigneeId={editAssigneeId}
								assigneeLabel={editAssigneeLabel}
								users={admins}
								disabled={saving}
								minHeightClass="min-h-32"
							/>
							<div class="mt-2 flex gap-2">
								<button
									type="submit"
									class="btn btn-sm btn-neutral"
									disabled={saving || !editContent.trim()}>Save changes</button
								>
								<button
									type="button"
									class="btn btn-outline btn-sm"
									disabled={saving}
									onclick={() => {
										editingId = '';
										editAssigneeId = '';
										editAssigneeLabel = '';
									}}>Cancel</button
								>
							</div>
						</form>
					{:else}
						<button
							type="button"
							class={`w-full rounded-lg border p-3 text-left text-base-content transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content ${selectedId === comment.id ? 'border-base-content/60 ring-2 ring-base-content/15' : 'border-base-300'} ${comment.resolved ? 'bg-base-200' : 'bg-base-100'}`}
							aria-pressed={selectedId === comment.id}
							disabled={saving}
							onclick={() => {
								selectedId = comment.id;
								deletingId = '';
							}}
						>
							<div class="flex items-start justify-between gap-2">
								<span class="text-xs font-semibold">{authorName(comment)}</span>
								<div class="flex flex-wrap justify-end gap-1">
									{#if comment.assignee}<span class="max-w-full rounded-lg border border-base-content/30 px-2 py-0.5 text-xs leading-5 break-words"
											>Assigned: {assigneeName(comment)}</span
										>{/if}
									{#if comment.resolved}<span class="badge gap-1 badge-sm badge-success"
											><IconCheck class="size-3" /> Resolved</span
										>{/if}
								</div>
							</div>
							<p class="mt-2 text-sm break-words whitespace-pre-wrap">
								{comment.content}
							</p>
							<time class="mt-2 block text-xs text-base-content/75" datetime={comment.created}
								>{formatDate(comment.created)}</time
							>
						</button>
					{/if}
					{#if selectedId === comment.id && editingId !== comment.id}
						{#if deletingId === comment.id}
							<div class="rounded-lg border border-base-content/30 bg-base-200 p-3">
								<p class="text-sm text-base-content">Delete this comment permanently?</p>
								<div class="mt-2 flex gap-2">
									<button
										type="button"
										class="btn btn-sm btn-error"
										disabled={saving}
										onclick={() => deleteComment(comment)}>Delete comment</button
									>
									<button
										type="button"
										class="btn btn-outline btn-sm"
										disabled={saving}
										onclick={() => (deletingId = '')}>Cancel</button
									>
								</div>
							</div>
						{:else}
							<div class="flex gap-2">
								<button
									type="button"
									class="btn flex-1 btn-outline btn-sm"
									disabled={saving}
									onclick={() => {
										editingId = comment.id;
										editContent = comment.content;
										editAssigneeId = comment.assignee ?? '';
										editAssigneeLabel = assigneeName(comment);
									}}><IconPencil class="size-3.5" /> Edit</button
								>
								<button
									type="button"
									class="btn flex-1 btn-outline btn-sm"
									disabled={saving}
									onclick={() => (deletingId = comment.id)}
									><IconTrash class="size-3.5" /> Delete</button
								>
							</div>
							{#if comment.assignee}
								<div class="mt-2 flex flex-wrap items-start justify-between gap-2 rounded-lg bg-base-200 px-3 py-2">
									<span class="min-w-0 flex-1 text-xs leading-5 break-words">Assigned to {assigneeName(comment)}</span>
									<button
										type="button"
										class="btn btn-ghost btn-xs"
										disabled={saving}
										onclick={() => clearAssignee(comment)}>Clear assignment</button
									>
								</div>
							{/if}
						{/if}
						{#if !comment.resolved && deletingId !== comment.id}
							<button
								class="btn w-full gap-2 btn-sm btn-success"
								type="button"
								disabled={saving}
								onclick={() => resolveComment(comment)}
							>
								<IconCheck class="size-4" /> Resolve comment
							</button>
						{/if}
					{/if}
				{/each}
			{/if}
		</div>

		<form
			class="border-t border-base-300 p-3"
			onsubmit={(event) => {
				event.preventDefault();
				addComment();
			}}
		>
			{#if error}<p class="mb-2 text-sm text-error">{error}</p>{/if}
			{#if adminError}<p class="mb-2 text-sm text-error">{adminError}</p>{/if}
			<AdminMentionComposer
				id={`${targetField}-comment`}
				label="Write a comment"
				bind:content
				bind:assigneeId
				users={admins}
				disabled={saving}
			/>
			<button
				class="btn mt-2 w-full gap-2 btn-sm btn-primary"
				type="submit"
				disabled={!content.trim() || saving}
			>
				<IconSend class="size-4" />
				{saving ? 'Sending...' : 'Send comment'}
			</button>
		</form>
	</aside>
{/if}
