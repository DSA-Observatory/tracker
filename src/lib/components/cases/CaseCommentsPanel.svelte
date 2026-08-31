<script lang="ts">
	import { authStore, pb } from '$lib/database';
	import type { CaseCommentRecord } from '$lib/comments';
	import { onMount } from 'svelte';
	import IconCheck from '~icons/lucide/check';
	import IconMessageSquare from '~icons/lucide/message-square';
	import IconSend from '~icons/lucide/send';

	let { caseId, selectedCommentId }: { caseId: string; selectedCommentId?: string } = $props();
	let comments = $state<CaseCommentRecord[]>([]);
	let content = $state('');
	let selectedId = $state(selectedCommentId ?? '');
	let loading = $state(true);
	let saving = $state(false);
	let error = $state('');

	function authorName(comment: CaseCommentRecord) {
		const author = comment.expand?.author;
		return author?.name || author?.username || author?.email || 'Admin';
	}

	function formatDate(value: string) {
		return new Intl.DateTimeFormat('en', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}

	async function loadComments() {
		if (!authStore.isAdmin) {
			loading = false;
			return;
		}

		try {
			comments = await pb.collection('case_comments').getFullList<CaseCommentRecord>({
				filter: pb.filter('case = {:caseId}', { caseId }),
				sort: 'created',
				expand: 'author,resolved_by'
			});
		} catch (err) {
			console.error('Error loading case comments:', err);
			error = 'Could not load comments.';
		} finally {
			loading = false;
		}
	}

	async function addComment() {
		const message = content.trim();
		if (!message || !authStore.user?.id || saving) return;

		saving = true;
		error = '';
		try {
			const comment = await pb.collection('case_comments').create<CaseCommentRecord>({
				case: caseId,
				author: authStore.user.id,
				content: message,
				resolved: false
			});
			content = '';
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

	onMount(() => {
		loadComments();
		if (!authStore.isAdmin) return;

		pb.collection('case_comments')
			.subscribe('*', loadComments)
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
					<button
						type="button"
						class={`w-full rounded-lg border p-3 text-left transition ${selectedId === comment.id ? 'border-primary ring-2 ring-primary/20' : 'border-base-300'} ${comment.resolved ? 'bg-base-200/70 text-base-content/60' : 'bg-base-100'}`}
						onclick={() => (selectedId = comment.id)}
					>
						<div class="flex items-start justify-between gap-2">
							<span class="text-xs font-semibold">{authorName(comment)}</span>
							{#if comment.resolved}<span class="badge gap-1 badge-sm badge-success"
									><IconCheck class="size-3" /> Resolved</span
								>{/if}
						</div>
						<p class={`mt-2 text-sm whitespace-pre-wrap ${comment.resolved ? 'line-through' : ''}`}>
							{comment.content}
						</p>
						<time class="mt-2 block text-xs text-base-content/50" datetime={comment.created}
							>{formatDate(comment.created)}</time
						>
					</button>
					{#if selectedId === comment.id && !comment.resolved}
						<button
							class="btn w-full gap-2 btn-sm btn-success"
							type="button"
							disabled={saving}
							onclick={() => resolveComment(comment)}
						>
							<IconCheck class="size-4" /> Resolve comment
						</button>
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
			<label class="sr-only" for="case-comment">Write a comment</label>
			<textarea
				id="case-comment"
				class="textarea-bordered textarea min-h-24 w-full"
				bind:value={content}
				maxlength="4000"
				placeholder="Write a comment..."
			></textarea>
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
