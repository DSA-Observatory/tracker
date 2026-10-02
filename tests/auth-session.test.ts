import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import PocketBase from 'pocketbase';
import { compileModule } from 'svelte/compiler';
// @ts-expect-error Svelte's internal runtime does not expose declarations.
// eslint-disable-next-line svelte/no-svelte-internal -- Execute the compiler-generated client runtime in isolation.
import * as client from 'svelte/internal/client';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { isAdminUser } from '../src/lib/admin';

const source = await readFile(
	new URL('../src/lib/database/stores/auth.svelte.ts', import.meta.url),
	'utf8'
);
const compiled = compileModule(
	transpileModule(source, {
		compilerOptions: { target: ScriptTarget.ESNext, module: ModuleKind.ESNext }
	}).outputText,
	{
		generate: 'client'
	}
).js.code;

function session(expiresIn: number, isAdmin = true) {
	const pb = new PocketBase('http://localhost:64011');
	const token = `e30.${Buffer.from(
		JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresIn })
	).toString('base64url')}.signature`;
	pb.authStore.save(token, {
		id: 'admin',
		collectionId: 'users',
		collectionName: 'users',
		email: 'admin@example.com',
		is_admin: isAdmin
	});
	const listeners = new Map<string, () => void>();
	const document = {
		visibilityState: 'visible',
		addEventListener: (event: string, callback: () => void) => listeners.set(event, callback)
	};
	const store = runInNewContext(
		compiled.replace(/^import .*;$/gm, '').replace('export const authStore', 'const authStore') +
			'\nauthStore;',
		{
			$: client,
			pb,
			browser: true,
			isAdminUser,
			window: {
				addEventListener: (event: string, callback: () => void) => listeners.set(event, callback)
			},
			document
		}
	);
	return { pb, store, listeners, token };
}

test('expired stored admin is signed out on startup', () => {
	const { pb, store } = session(-60);
	expect(store.user).toBe(null);
	expect(store.isAuthenticated).toBe(false);
	expect(store.isAdmin).toBe(false);
	expect(pb.authStore.token).toBe('');
});

test('valid session is preserved without granting non-admins access', () => {
	const { pb, store, token } = session(3600, false);
	expect(store.isAuthenticated).toBe(true);
	expect(store.isAdmin).toBe(false);
	expect(pb.authStore.token).toBe(token);
});

test('returning to the app clears a session that expired while away', () => {
	for (const event of ['focus', 'visibilitychange']) {
		const { pb, store, listeners } = session(3600);
		Object.defineProperty(pb.authStore, 'isValid', { get: () => false });
		listeners.get(event)!();
		expect(store.isAuthenticated).toBe(false);
		expect(store.isAdmin).toBe(false);
		expect(pb.authStore.token).toBe('');
	}
});

test('logout and auth changes update the displayed session', () => {
	const { pb, store, token } = session(3600);
	store.logout();
	expect(store.isAuthenticated).toBe(false);
	pb.authStore.save(token, {
		id: 'admin',
		collectionId: 'users',
		collectionName: 'users',
		is_admin: true
	});
	expect(store.isAuthenticated).toBe(true);
	expect(store.isAdmin).toBe(true);
	pb.authStore.clear();
	expect(store.user).toBe(null);
});
