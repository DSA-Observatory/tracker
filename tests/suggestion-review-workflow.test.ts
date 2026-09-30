import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

test('suggestion review is admin-only, transactional, and creates one private draft', async () => {
	const migration = await readFile(
		new URL('../pocketbase/pb_migrations/15_suggestion_review_workflow.js', import.meta.url),
		'utf8'
	);
	const hook = await readFile(
		new URL('../pocketbase/pb_hooks/case_submission_workflow.pb.js', import.meta.url),
		'utf8'
	);

	expect(migration).toContain('@request.auth.is_admin = true');
	expect(migration).toContain('@request.auth.email = "ctw@ctwhome.com"');
	expect(migration).toContain("name: 'resulting_case'");
	expect(migration).toContain("name: 'decided_by'");
	expect(migration).toContain("name: 'decided_at'");
	expect(migration).toContain("name: 'submission'");
	expect(migration).toContain("name: 'submitted_by'");
	expect(migration).toContain('submissions.updateRule = null');
	expect(migration).toContain('submissions.deleteRule = null');

	expect(hook).toContain("'/api/admin/submissions/{id}/decision'");
	expect(hook).toContain('e.app.runInTransaction');
	expect(hook).toContain("caseRecord.set('case_id', `suggestion-${submission.id}`)");
	expect(hook).toContain("caseRecord.set('status', 'draft')");
	expect(hook).toContain("caseRecord.set('published', false)");
	expect(hook).toContain("submission.set('resulting_case', caseRecord.id)");
	expect(hook).toContain("submission.set('decided_by', e.auth.id)");
	expect(hook).toContain("findFirstRecordByFilter('cases', 'submitted_by = {:submission}'");
	expect(hook).toContain("if (currentStatus === 'accepted' && resultingCaseId)");
	expect(hook).toContain("if (currentStatus === 'rejected' && decision === 'rejected')");
});

test('public suggestions cannot set workflow fields and comments require one target', async () => {
	const hook = await readFile(
		new URL('../pocketbase/pb_hooks/case_submission_workflow.pb.js', import.meta.url),
		'utf8'
	);

	expect(hook).toContain("e.record.set('status', 'pending')");
	expect(hook).toContain("e.record.set('resulting_case', '')");
	expect(hook).toContain("e.record.set('decided_by', '')");
	expect(hook).toContain('if ((caseId ? 1 : 0) + (submissionId ? 1 : 0) !== 1)');
	expect(hook).toContain("throw e.badRequestError('Source links must use HTTP or HTTPS.'");
	expect(hook).toContain("e.record.getStringSlice('document_links')");
});
