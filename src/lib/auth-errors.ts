export type AuthFailure = {
	message: string;
	report: string;
};

function object(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function safeText(value: unknown): string {
	if (typeof value !== 'string') return '';
	return value
		.replace(/([?&#](?:token|invite|password|passwordConfirm)=)[^&#\s]+/gi, '$1[redacted]')
		.replace(/[A-Za-z0-9_-]{48,}/g, '[redacted]')
		.slice(0, 400);
}

/** Only copy response messages/codes, never request bodies, URLs, tokens or error stacks. */
export function getAuthFailure(error: unknown, operation: string): AuthFailure {
	const source = object(error);
	const response = object(source.response);
	const data = object(response.data);
	const status = typeof source.status === 'number' ? source.status : undefined;
	const serverMessage =
		safeText(response.message) ||
		safeText(source.message) ||
		safeText(error) ||
		'Unexpected error.';
	const fields = Object.entries(data)
		.filter(([field]) => /^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(field))
		.slice(0, 12)
		.map(([field, value]) => {
			const detail = object(value);
			return {
				field,
				code: safeText(detail.code),
				message: safeText(detail.message) || safeText(value)
			};
		});

	let message = fields.length
		? fields.map((field) => `${field.field}: ${field.message || field.code}`).join(' ')
		: serverMessage;
	if (fields.some((field) => field.code === 'validation_token_collection_mismatch')) {
		message =
			'This link is for a different account system. Send the details below to an administrator.';
	} else if (fields.some((field) => field.field === 'token')) {
		message =
			'This link is invalid or no longer usable. Request a password reset below, or ask an administrator to resend your invitation.';
	} else if (status === 0) {
		message = 'Could not reach the account server. Check your connection and try again.';
	} else if (status === 429) {
		message = 'Too many attempts. Wait a little before trying again.';
	} else if (status && status >= 500) {
		message =
			'The account server could not complete this request. Try again, or send the details below to an administrator.';
	} else if (operation === 'Sign in' && status === 400 && !fields.length) {
		message =
			'Your email or password was not accepted. Check your details, or use Forgot your password? to recover access.';
	}

	return {
		message,
		report: [
			'DSA Case Law Tracker — account error',
			`Action: ${operation}`,
			`Time (UTC): ${new Date().toISOString()}`,
			...(status !== undefined ? [`HTTP status: ${status || 'network error'}`] : []),
			`Message: ${serverMessage}`,
			...fields.map(
				(field) => `${field.field}${field.code ? ` [${field.code}]` : ''}: ${field.message}`
			)
		].join('\n')
	};
}
