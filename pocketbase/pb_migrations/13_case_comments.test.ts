import { expect, test } from 'bun:test';

test('case comments migration protects every operation with the admin rule', async () => {
	const source = await Bun.file(new URL('./13_case_comments.js', import.meta.url)).text();

	expect(source).toContain(`const adminRule = '@request.auth.is_admin = true'`);
	expect(source).toContain("app.findCollectionByNameOrId('case_comments')");
	for (const operation of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']) {
		expect(source).toContain(`${operation}: adminRule`);
	}
	expect(source).toContain("name: 'case'");
	expect(source).toContain("name: 'author'");
	expect(source).toContain("name: 'content'");
	expect(source).toContain("name: 'resolved'");
});
