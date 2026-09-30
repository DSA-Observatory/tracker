import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);

const read = (path: string) => readFile(fileURLToPath(new URL(path, root)), 'utf8');

test('case publication migration backfills cases and enforces visibility', async () => {
	const source = await read('pocketbase/pb_migrations/14_case_publication_state.js');

	expect(source).toContain('@request.auth.email = "ctw@ctwhome.com"');
	expect(source).toContain('@request.auth.is_admin = true');
	expect(source).toContain('published = true || ${adminRule}');
	expect(source).toContain('@request.body.published:changed = false');
	expect(source).toContain('@request.body.published != true');
	expect(source).toContain('@request.body.is_admin:changed = false');
	expect(source).toContain("record.set('published', true)");
	expect(source).toContain('documents.protected = true');
});

test('fresh case collections use the publication access rules', async () => {
	const source = await read('scripts/apply-cases-collection.ts');

	expect(source).toContain('listRule: `published = true || ${adminRule}`');
	expect(source).toContain('viewRule: `published = true || ${adminRule}`');
	expect(source).toContain('@request.auth.email = "ctw@ctwhome.com"');
	expect(source).toContain('@request.body.published:changed = false');
	expect(source).toContain('protected: true');
});

test('the case editor exposes an admin-only draft and published control', async () => {
	const source = await read('src/lib/components/cases/CaseEditorForm.svelte');

	expect(source).toContain('{#if authStore.isAdmin}');
	expect(source).toContain('aria-label="Publication status"');
	expect(source.includes('>Draft</button')).toBe(true);
	expect(source.includes('>Published</button')).toBe(true);
	expect(source).toContain('published: form.published');
	expect(source).toContain('pb.files.getToken()');
	expect(source).toContain('{ token: fileToken }');
	expect(source.includes("form.published || form.status === 'published'")).toBe(false);

	const detailSource = await read('src/routes/cases/[id]/+page.svelte');
	expect(detailSource).toContain('pb.files.getToken()');
	expect(detailSource).toContain('{ token: fileToken }');
});
