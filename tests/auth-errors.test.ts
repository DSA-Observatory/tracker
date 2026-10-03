import { expect, test } from 'bun:test';
import { getAuthFailure } from '../src/lib/auth-errors';

test('surfaces the token validation reason with copyable support details', () => {
	const failure = getAuthFailure(
		{
			status: 400,
			response: {
				message: 'An error occurred while validating the submitted data.',
				data: { token: { code: 'validation_invalid_token', message: 'Invalid or expired token.' } }
			}
		},
		'Reset password'
	);
	expect(failure.message).toContain('Request a password reset');
	expect(failure.report).toContain('HTTP status: 400');
	expect(failure.report).toContain('token [validation_invalid_token]: Invalid or expired token.');
	expect(failure.report).toContain('Time (UTC):');
});

test('reports password and confirmation errors without request data or parameters', () => {
	const failure = getAuthFailure(
		{
			status: 400,
			url: 'https://example.com?token=secret',
			originalError: { password: 'private-password' },
			response: {
				message: 'Validation failed.',
				data: {
					password: {
						code: 'validation_length_out_of_range',
						message: 'Use at least 8 characters.',
						params: { password: 'private-password' }
					},
					passwordConfirm: { code: 'validation_not_equal', message: 'Passwords do not match.' }
				}
			}
		},
		'Accept invitation'
	);
	expect(failure.message).toContain('Use at least 8 characters.');
	expect(failure.message).toContain('Passwords do not match.');
	expect(failure.report).not.toContain('private-password');
	expect(failure.report).not.toContain('example.com');
});

test('does not describe throttling or server errors as invalid links', () => {
	for (const status of [429, 503]) {
		const failure = getAuthFailure(
			{
				status,
				response: {
					message: 'Try again later.',
					data: {
						token: { code: 'rate_limited', message: 'Try again later.' }
					}
				}
			},
			'Accept invitation'
		);
		expect(failure.message).not.toContain('link is invalid');
	}
	expect(getAuthFailure({ status: 0 }, 'Sign in').message).toContain('connection');
});

test('redacts token-bearing messages and opaque invitation secrets', () => {
	const secret = 'X'.repeat(64);
	const failure = getAuthFailure(
		new Error(`https://example.com/password?token=short-secret#invite=${secret}`),
		'Accept invitation'
	);
	expect(failure.report).not.toContain(secret);
	expect(failure.report).not.toContain('short-secret');
	expect(failure.report).toContain('[redacted]');
});

test('distinguishes a wrong auth collection from an unusable token', () => {
	const failure = getAuthFailure(
		{
			status: 400,
			response: {
				data: {
					token: {
						code: 'validation_token_collection_mismatch',
						message: 'Different auth collection.'
					}
				}
			}
		},
		'Reset password'
	);
	expect(failure.message).toContain('different account system');
});
