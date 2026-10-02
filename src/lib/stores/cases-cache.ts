import { browser } from '$app/environment';
import { pb, type CaseRecord } from '$lib/database';

// Records never go into Web Storage; auth changes discard all cached private data.
const cache = new Map<string, CaseRecord[]>();
if (browser) pb.authStore.onChange(() => cache.clear());

export function casesCacheKey(drafts: boolean) {
	return `${pb.baseURL}:${pb.authStore.token}:${drafts ? 'drafts' : 'all'}`;
}

export function readCasesCache(key: string) {
	return browser ? cache.get(key) : undefined;
}

export function writeCasesCache(key: string, records: CaseRecord[]) {
	if (browser) cache.set(key, records);
}
