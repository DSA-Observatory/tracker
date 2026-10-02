import { browser } from '$app/environment';

const played = new Set<string>();

/** Claim an entrance once per tab session, with an in-memory fallback. */
export function claimEntryAnimation(key: string): boolean {
	if (!browser || played.has(key)) return false;
	played.add(key);
	try {
		const storageKey = `entry-animation:${key}`;
		if (sessionStorage.getItem(storageKey)) return false;
		sessionStorage.setItem(storageKey, 'played');
	} catch {
		// Navigation still remembers entrances when browser storage is unavailable.
	}
	return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
