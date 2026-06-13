import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/public';

export const pb = new PocketBase(env.PUBLIC_POCKETBASE_URL || 'http://localhost:8095');

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
