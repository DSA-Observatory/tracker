import type { SourceEntry } from '$lib/case-sources';
import type { CaseForm } from '$lib/components/cases/types';

type SelectedDocument = Pick<File, 'lastModified' | 'name' | 'size' | 'type'>;

function normalizeRichText(value: string) {
	return value === '<p></p>' ? '' : value;
}

export function caseEditorSnapshot(
	form: CaseForm,
	primarySources: SourceEntry[],
	secondarySources: SourceEntry[],
	selectedDocuments: SelectedDocument[]
) {
	const editableForm: Partial<CaseForm> = { ...form };
	delete editableForm.outcome;
	delete editableForm.courts;
	delete editableForm.published;
	delete editableForm.primary_sources;
	delete editableForm.secondary_sources;

	return JSON.stringify({
		form: {
			...editableForm,
			summary: normalizeRichText(form.summary),
			editorial_notes: normalizeRichText(form.editorial_notes)
		},
		primarySources: primarySources.map(({ title, url }) => ({ title, url })),
		secondarySources: secondarySources.map(({ title, url }) => ({ title, url })),
		selectedDocuments: selectedDocuments.map(({ lastModified, name, size, type }) => ({
			lastModified,
			name,
			size,
			type
		}))
	});
}
