import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

test('case comments migration protects every operation with the admin rule', async () => {
	const source = await readFile(
		new URL('../pocketbase/pb_migrations/13_case_comments.js', import.meta.url),
		'utf8'
	);

	expect(source).toContain('@request.auth.is_admin = true');
	expect(source).toContain('@request.auth.email = "ctw@ctwhome.com"');
	expect(source).toContain("app.findCollectionByNameOrId('case_comments')");
	for (const operation of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']) {
		expect(source).toContain(`${operation}: adminRule`);
	}
	expect(source).toContain("name: 'case'");
	expect(source).toContain("name: 'author'");
	expect(source).toContain("name: 'content'");
	expect(source).toContain("name: 'resolved'");
});
