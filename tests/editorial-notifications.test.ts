import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const hookUrl = new URL(
	'../pocketbase/pb_hooks/case_submission_notifications.pb.js',
	import.meta.url
);
const commentHelperUrl = new URL(
	'../pocketbase/pb_hooks/comment_assignment_helpers.js',
	import.meta.url
);

test('case submissions notify editors and confirm receipt to the submitter', async () => {
	const source = await readFile(hookUrl, 'utf8');

	expect(source).toContain("$os.getenv('CASE_SUBMISSION_NOTIFY_EMAILS')");
	expect(source).toContain("'ctw@ctwhome.com'");
	expect(source).toContain('We received your suggested case:');
	expect(source).toContain('New suggested case:');
	expect(source).toContain('to: [{ address: submitterEmail }]');
	expect(source).toContain('https://dsa-observatory.github.io/tracker');
});

test('new case and suggestion comments notify configured editors', async () => {
	const [source, helper] = await Promise.all([
		readFile(hookUrl, 'utf8'),
		readFile(commentHelperUrl, 'utf8')
	]);

	expect(source).toContain("}, 'case_comments');");
	expect(source).toContain('comment_assignment_helpers.js');
	expect(helper).toContain('New editorial comment:');
	expect(helper).toContain("record.getString('submission')");
	expect(helper).toContain("record.getString('case')");
});
