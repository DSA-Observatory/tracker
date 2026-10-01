import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

test('admin draft navigation scopes the case list to unpublished records', async () => {
	const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
	const layout = await read('src/lib/components/admin/AdminPanelLayout.svelte');
	const route = await read('src/routes/admin/drafts/+page.svelte');
	const table = await read('src/lib/components/CasesTable.svelte');
	expect(layout).toContain("title: 'Draft cases'");
	expect(layout).toContain("path: '/admin/drafts'");
	expect(layout).toContain('filter: "published = false && status != \'archived\'"');
	expect(route).toContain('<AdminPanelLayout>');
	expect(route).toContain('publicationFilter="draft"');
	expect(table).toContain("publicationFilter === 'draft'");
	expect(table).toContain("published = false && status != 'archived'");
});

test('accept action uses an AA contrast color pair', async () => {
	const source = await readFile(
		new URL('../src/routes/admin/submissions/[id]/+page.svelte', import.meta.url),
		'utf8'
	);
	expect(source).toContain('bg-emerald-700 text-white');
	expect(source.includes('btn-success')).toBe(false);
});
