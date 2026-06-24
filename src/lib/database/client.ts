import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';

export const pb = new PocketBase(PUBLIC_POCKETBASE_URL || 'http://localhost:46218');

// Types for the todos collection
export interface Todo {
	id: string;
	name: string;
	completed: boolean;
	Description?: string;
	user: string; // User ID
	created: string;
	updated: string;
}

// Types for the posts collection
export interface Post {
	id: string;
	title: string;
	content: string;
	created: string;
	updated: string;
}

export type CaseStatus =
	| 'draft'
	| 'review'
	| 'pending'
	| 'decided'
	| 'appealed'
	| 'closed'
	| 'archived'
	| 'published';

export interface CaseRecord {
	id: string;
	case_id: string;
	title: string;
	ecli?: string;
	filing_date?: string;
	decision_date?: string;
	outcome?: string;
	status: CaseStatus;
	court?: string;
	courts?: string[];
	jurisdiction?: string;
	plaintiffs?: string[];
	defendants?: string[];
	legal_areas?: string[];
	legal_basis?: string[];
	case_scope?: string;
	procedural_events?: { date?: string; label?: string; description?: string }[];
	summary?: string;
	timeline?: string;
	categories?: string[];
	themes?: string[];
	primary_sources?: string[];
	secondary_sources?: string[];
	keywords?: string[];
	dsa_articles?: string[];
	documents?: string[];
	document_links?: string[];
	source_limitations?: string;
	citations_to?: string[];
	cited_by?: string[];
	commentary?: string;
	editorial_notes?: string;
	submitted_by?: string;
	published: boolean;
	created: string;
	updated: string;
}

export type CaseSubmissionStatus = 'new' | 'review' | 'accepted' | 'rejected' | 'archived';

export interface CaseSubmissionRecord {
	id: string;
	case_id?: string;
	title: string;
	ecli?: string;
	filing_date?: string;
	decision_date?: string;
	case_status?: CaseStatus;
	outcome?: string;
	jurisdiction?: string;
	court?: string;
	courts?: string[];
	plaintiffs?: string[];
	defendants?: string[];
	parties?: string;
	legal_areas?: string[];
	legal_basis?: string[];
	case_scope?: string;
	procedural_events?: { date?: string; label?: string; description?: string }[];
	timeline?: string;
	categories?: string[];
	themes?: string[];
	primary_sources?: string[];
	secondary_sources?: string[];
	keywords?: string[];
	dsa_articles?: string[];
	document_links?: string[];
	case_url?: string;
	summary?: string;
	source_limitations?: string;
	submitter_name?: string;
	submitter_email?: string;
	status: CaseSubmissionStatus;
	editorial_notes?: string;
	created: string;
	updated: string;
}
