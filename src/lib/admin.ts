export const ADMIN_EMAILS = ['ctw@ctwhome.com'];

export function isAdminEmail(email?: string | null) {
	return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}
