import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';

const source = await readFile(
	new URL('../src/lib/components/cases/CaseCommentsPanel.svelte', import.meta.url),
	'utf8'
);
const script = source
	.match(/<script lang="ts">([\s\S]*?)<\/script>/)![1]
	.replace(/import[\s\S]*?;/g, '');
const javascript = new Bun.Transpiler({ loader: 'ts' }).transformSync(script);

function setup(fail = false) {
	const updates: unknown[] = [];
	const deletions: string[] = [];
	const context = createContext({
		$props: () => ({ caseId: 'case-1' }),
		$state: (value: unknown) => value,
		$derived: (value: unknown) => value,
		$effect: () => {},
		onMount: () => {},
		authStore: { isAdmin: true, user: { id: 'admin-1' } },
		pb: {
			filter: () => '',
			collection: () => ({
				getFullList: async () => [],
				update: async (id: string, payload: unknown) => {
					if (fail) throw new Error('Unavailable');
					updates.push({ id, payload });
				},
				delete: async (id: string) => {
					if (fail) throw new Error('Unavailable');
					deletions.push(id);
				}
			})
		}
	});
	runInContext(javascript, context);
	return { context, updates, deletions };
}

test('editing trims content and updates no author, target or resolution fields', async () => {
	const { context, updates } = setup();
	await runInContext(
		"editingId = 'comment-1'; editContent = '  Revised text  '; saveComment({ id: editingId });",
		context
	);
	expect(updates).toEqual([{ id: 'comment-1', payload: { content: 'Revised text' } }]);
	expect(runInContext('editingId', context)).toBe('');
});

test('empty edits, non-admins and pending operations cannot save', async () => {
	const { context, updates } = setup();
	await runInContext("editContent = '  '; saveComment({ id: 'comment-1' });", context);
	await runInContext(
		"editContent = 'Text'; authStore.isAdmin = false; saveComment({ id: 'comment-1' });",
		context
	);
	await runInContext(
		"authStore.isAdmin = true; saving = true; saveComment({ id: 'comment-1' });",
		context
	);
	expect(updates).toEqual([]);
});

test('failed edits preserve the draft and allow retry', async () => {
	const { context } = setup(true);
	await runInContext(
		"editingId = 'comment-1'; editContent = 'Draft'; saveComment({ id: editingId });",
		context
	);
	expect(runInContext('editingId', context)).toBe('comment-1');
	expect(runInContext('editContent', context)).toBe('Draft');
	expect(runInContext('saving', context)).toBe(false);
	expect(runInContext('error', context)).toContain('Your edits have been kept');
});

test('deletion requires confirmation of the specific comment and clears selection', async () => {
	const { context, deletions } = setup();
	await runInContext("deleteComment({ id: 'comment-1' });", context);
	await runInContext("deletingId = 'other'; deleteComment({ id: 'comment-1' });", context);
	expect(deletions).toEqual([]);
	await runInContext(
		"selectedId = deletingId = 'comment-1'; deleteComment({ id: 'comment-1' });",
		context
	);
	expect(deletions).toEqual(['comment-1']);
	expect(runInContext('selectedId', context)).toBe('');
	expect(runInContext('deletingId', context)).toBe('');
});

test('failed deletion preserves confirmation and reports the failure', async () => {
	const { context, deletions } = setup(true);
	await runInContext(
		"selectedId = deletingId = 'comment-1'; deleteComment({ id: 'comment-1' });",
		context
	);
	expect(deletions).toEqual([]);
	expect(runInContext('selectedId', context)).toBe('comment-1');
	expect(runInContext('deletingId', context)).toBe('comment-1');
	expect(runInContext('saving', context)).toBe(false);
	expect(runInContext('error', context)).toBe('Could not delete this comment.');
});
