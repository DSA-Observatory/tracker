import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { getAuthFailure } from '../src/lib/auth-errors';

const source = await readFile(
	new URL('../src/routes/password/+page.svelte', import.meta.url),
	'utf8'
);
const script = source
	.match(/<script lang="ts">([\s\S]*?)<\/script>/)![1]
	.replace(/import[\s\S]*?;/g, '');
const javascript = new Bun.Transpiler({ loader: 'ts' }).transformSync(script);

test('successful password setup clears the old session before returning to sign-in', async () => {
	let logouts = 0;
	const context = createContext({
		$state: (value: unknown) => value,
		$derived: (value: unknown) => value,
		page: { url: new URL(`https://example.com/password/#invite=${'S'.repeat(64)}`) },
		URLSearchParams,
		getAuthFailure,
		pb: { send: async () => undefined },
		authStore: { logout: () => logouts++ }
	});
	runInContext(javascript, context);
	await runInContext(
		"password = 'NewPassword123!'; passwordConfirm = password; submitPassword();",
		context
	);
	expect(logouts).toBe(1);
	expect(runInContext('success', context)).toContain('You can now sign in.');
	expect(runInContext('password', context)).toBe('');
});

test('failed setup keeps the existing session and shows reportable backend details', async () => {
	let logouts = 0;
	const context = createContext({
		$state: (value: unknown) => value,
		$derived: (value: unknown) => value,
		page: { url: new URL(`https://example.com/password/#invite=${'S'.repeat(64)}`) },
		URLSearchParams,
		getAuthFailure,
		pb: {
			send: async () => {
				throw {
					status: 400,
					response: {
						message: 'Invalid invitation.',
						data: { token: { code: 'invalid_token', message: 'No longer usable.' } }
					}
				};
			}
		},
		authStore: { logout: () => logouts++ }
	});
	runInContext(javascript, context);
	await runInContext(
		"password = 'NewPassword123!'; passwordConfirm = password; submitPassword();",
		context
	);
	expect(logouts).toBe(0);
	expect(runInContext('error.report', context)).toContain('token [invalid_token]');
	expect(runInContext('isSubmitting', context)).toBe(false);
});
