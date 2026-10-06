import type { CaseStatus } from '$lib/database';

export type FilterGroup = 'countries' | 'categories' | 'articles' | 'courts' | 'parties' | 'years';

export type SearchScope =
	| 'all'
	| 'case'
	| 'parties'
	| 'legal'
	| 'sources'
	| 'timeline'
	| 'primary'
	| 'secondary';

export type ViewMode = 'cards' | 'grid' | 'map' | 'table';
export type FilterLayout = 'top' | 'left';

export type ActiveFilterChip = {
	group: FilterGroup;
	value: string;
	label: string;
};

export type CaseForm = {
	case_id: string;
	title: string;
	ecli: string;
	decision_reference: string;
	procedural_wording: string;
	decision_date: string;
	status: CaseStatus;
	court: string;
	jurisdiction: string;
	plaintiffs: string;
	defendants: string;
	outcome: string;
	courts: string;
	legal_areas: string;
	legal_basis: string;
	case_scope: string;
	procedural_events: string;
	summary: string;
	timeline: string;
	categories: string;
	primary_sources: string;
	secondary_sources: string;
	source_limitations: string;
	editorial_notes: string;
	keywords: string;
	dsa_articles: string;
	published: boolean;
};

export const statusOptions: CaseStatus[] = [
	'draft',
	'review',
	'pending',
	'decided',
	'appealed',
	'closed',
	'archived',
	'published'
];

export const emptyCaseForm = (): CaseForm => ({
	case_id: '',
	title: '',
	ecli: '',
	decision_reference: '',
	procedural_wording: '',
	decision_date: '',
	status: 'draft',
	court: '',
	jurisdiction: '',
	plaintiffs: '',
	defendants: '',
	outcome: '',
	courts: '',
	legal_areas: '',
	legal_basis: '',
	case_scope: 'private enforcement',
	procedural_events: '',
	summary: '',
	timeline: '',
	categories: '',
	primary_sources: '',
	secondary_sources: '',
	source_limitations: '',
	editorial_notes: '',
	keywords: '',
	dsa_articles: '',
	published: false
});

export const splitCaseFormList = (value: string) =>
	value
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);

export const joinCaseFormList = (value?: string[]) =>
	Array.isArray(value) ? value.join(', ') : '';

export const splitCaseFormLines = (value: string) =>
	value
		.split('\n')
		.map((item) => item.trim())
		.filter(Boolean);

export const joinCaseFormLines = (value?: string[]) =>
	Array.isArray(value) ? value.join('\n') : '';
