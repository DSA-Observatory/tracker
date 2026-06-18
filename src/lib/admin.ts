export const ADMIN_EMAILS = ['ctw@ctwhome.com'];

type AdminUser = {
	email?: string | null;
	is_admin?: boolean | null;
};

export function isAdminEmail(email?: string | null) {
	return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export function isAdminUser(user?: AdminUser | null) {
	return !!user && (user.is_admin === true || isAdminEmail(user.email));
}
