import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';

export const pb = new PocketBase(PUBLIC_POCKETBASE_URL || 'http://localhost:8095');

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
	| 'published';

export interface CaseRecord {
	id: string;
	case_id: string;
	title: string;
	ecli?: string;
	filing_date?: string;
	decision_date?: string;
	status: CaseStatus;
	court?: string;
	jurisdiction?: string;
	plaintiffs?: string[];
	defendants?: string[];
	summary?: string;
	keywords?: string[];
	dsa_articles?: string[];
	documents?: string[];
	document_links?: string[];
	citations_to?: string[];
	cited_by?: string[];
	commentary?: string;
	published: boolean;
	created: string;
	updated: string;
}
