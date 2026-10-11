import { describe, expect, test } from 'bun:test';
import { caseEditorSnapshot } from '../src/lib/case-editor-dirty';
import { emptyCaseForm } from '../src/lib/components/cases/types';

const document = {
	lastModified: 1,
	name: 'decision.pdf',
	size: 42,
	type: 'application/pdf'
};

describe('case editor dirty snapshots', () => {
	test('detects form, rich editor, source and upload changes', () => {
		const form = emptyCaseForm();
		const baseline = caseEditorSnapshot(form, [], [], []);

		expect(caseEditorSnapshot({ ...form, title: 'A case' }, [], [], [])).not.toBe(baseline);
		expect(caseEditorSnapshot({ ...form, summary: '<p>Edited</p>' }, [], [], [])).not.toBe(
			baseline
		);
		expect(
			caseEditorSnapshot(form, [{ title: 'Decision', url: 'https://example.com' }], [], [])
		).not.toBe(baseline);
		expect(caseEditorSnapshot(form, [], [], [document])).not.toBe(baseline);
	});

	test('returns to the baseline when values and uploads are restored', () => {
		const form = { ...emptyCaseForm(), title: 'Original', summary: '<p>Original</p>' };
		const sources = [{ title: 'Decision', url: 'https://example.com' }];
		const baseline = caseEditorSnapshot(form, sources, [], []);
		const edited = { ...form, title: 'Edited', summary: '<p>Edited</p>' };

		expect(caseEditorSnapshot(edited, sources, [], [document])).not.toBe(baseline);
		expect(caseEditorSnapshot(form, sources, [], [])).toBe(baseline);
		expect(caseEditorSnapshot({ ...form, summary: '<p></p>' }, sources, [], [])).toBe(
			caseEditorSnapshot({ ...form, summary: '' }, sources, [], [])
		);
	});

	test('ignores server-managed visibility and hidden legacy values', () => {
		const form = emptyCaseForm();
		const baseline = caseEditorSnapshot(form, [], [], []);

		expect(
			caseEditorSnapshot(
				{ ...form, outcome: 'Granted', courts: 'Appeal court', published: true },
				[],
				[],
				[]
			)
		).toBe(baseline);
	});

	test('keeps edits made after save dispatch dirty', () => {
		const submittedForm = { ...emptyCaseForm(), title: 'Submitted title' };
		const submittedSnapshot = caseEditorSnapshot(submittedForm, [], [], []);

		expect(caseEditorSnapshot({ ...submittedForm, title: 'Late edit' }, [], [], [])).not.toBe(
			submittedSnapshot
		);
		expect(caseEditorSnapshot(submittedForm, [], [], [document])).not.toBe(submittedSnapshot);
		expect(caseEditorSnapshot(submittedForm, [], [], [])).toBe(submittedSnapshot);
	});
});
