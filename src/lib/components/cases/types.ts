export type FilterGroup =
	| 'statuses'
	| 'countries'
	| 'categories'
	| 'themes'
	| 'articles'
	| 'courts'
	| 'parties'
	| 'years';

export type SearchScope =
	| 'all'
	| 'case'
	| 'parties'
	| 'legal'
	| 'sources'
	| 'timeline'
	| 'primary'
	| 'secondary';

export type ViewMode = 'cards' | 'table';
export type FilterLayout = 'top' | 'left';

export type ActiveFilterChip = {
	group: FilterGroup;
	value: string;
	label: string;
};
