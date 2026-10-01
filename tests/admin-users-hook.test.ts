import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

import { isAdminUser } from '../src/lib/admin';

type Route = {
	method: string;
	path: string;
	handler: (event: AdminEvent) => void;
	middleware: unknown;
};

type AuthRecord = {
	collection: () => { name: string };
	getBool: (field: string) => boolean;
	getString: (field: string) => string;
};

type AdminEvent = ReturnType<typeof createEvent>['event'];

const source = await readFile(
	new URL('../pocketbase/pb_hooks/admin_users.pb.js', import.meta.url),
	'utf8'
);

function registerRoute() {
	let route: Route | undefined;
	const requireAuth = Symbol('requireAuth');

	runInNewContext(source, {
		routerAdd(method: string, path: string, handler: Route['handler'], middleware: unknown) {
			route = { method, path, handler, middleware };
		},
		$apis: { requireAuth: () => requireAuth }
	});

	expect(Boolean(route)).toBe(true);
	return { route: route!, requireAuth };
}

function createAuth({
	collection = 'users',
	isAdmin = false,
	email = 'user@example.com'
} = {}): AuthRecord {
	return {
		collection: () => ({ name: collection }),
		getBool: (field: string) => field === 'is_admin' && isAdmin,
		getString: (field: string) => (field === 'email' ? email : '')
	};
}

function createEvent({
	auth = createAuth({ isAdmin: true }),
	body = { verified: true }
}: {
	auth?: ReturnType<typeof createAuth> | null;
	body?: Record<string, unknown>;
} = {}) {
	const saved: Array<{ verified: unknown; set: (field: string, value: unknown) => void }> = [];
	const user = {
		verified: undefined as unknown,
		set(field: string, value: unknown) {
			if (field === 'verified') this.verified = value;
		}
	};
	let response: { status: number; body: unknown } | undefined;

	const event = {
		auth,
		requestInfo: () => ({ body }),
		forbiddenError(message: string) {
			return Object.assign(new Error(message), { status: 403 });
		},
		badRequestError(message: string) {
			return Object.assign(new Error(message), { status: 400 });
		},
		request: { pathValue: (name: string) => (name === 'id' ? 'target-user' : '') },
		app: {
			findRecordById: (collection: string, id: string) => {
				expect(collection).toBe('users');
				expect(id).toBe('target-user');
				return user;
			},
			save(record: typeof user) {
				saved.push(record);
			}
		},
		json(status: number, responseBody: unknown) {
			response = { status, body: responseBody };
		}
	};

	return { event, user, saved, getResponse: () => response };
}

function executeInIsolatedContext(handler: Route['handler'], event: AdminEvent) {
	return runInNewContext(`(${handler.toString()})(event)`, { event });
}

function thrownBy(run: () => unknown) {
	try {
		run();
		return null;
	} catch (error) {
		return error as Error & { status?: number };
	}
}

test('registers the verified-user route with authentication middleware', () => {
	const { route, requireAuth } = registerRoute();

	expect(route.method).toBe('PATCH');
	expect(route.path).toBe('/api/admin/users/{id}/verified');
	expect(route.middleware).toBe(requireAuth);
});

test('allows only flagged users admins and updates a boolean verified value', () => {
	const { route } = registerRoute();
	const enabled = createEvent({ body: { verified: true } });

	executeInIsolatedContext(route.handler, enabled.event);

	expect(enabled.user.verified).toBe(true);
	expect(enabled.saved).toEqual([enabled.user]);
	expect(enabled.getResponse()).toEqual({ status: 200, body: enabled.user });

	const disabled = createEvent({ body: { verified: false } });
	executeInIsolatedContext(route.handler, disabled.event);
	expect(disabled.user.verified).toBe(false);
});

test('denies unauthenticated, non-user, non-admin, and email-only identities', () => {
	const { route } = registerRoute();
	const identities = [
		null,
		createAuth({ collection: '_superusers', isAdmin: true }),
		createAuth(),
		createAuth({ email: 'ctw@ctwhome.com' })
	];

	for (const auth of identities) {
		const { event } = createEvent({ auth });
		const error = thrownBy(() => executeInIsolatedContext(route.handler, event));
		expect(error?.message).toBe('Admin access required.');
		expect(error?.status).toBe(403);
	}
});

test('rejects missing and non-boolean verified values without saving', () => {
	const { route } = registerRoute();

	for (const verified of [undefined, null, 1, 'true']) {
		const request = createEvent({ body: verified === undefined ? {} : { verified } });
		const error = thrownBy(() => executeInIsolatedContext(route.handler, request.event));
		expect(error?.message).toBe('verified must be a boolean.');
		expect(error?.status).toBe(400);
		expect(request.saved).toHaveLength(0);
	}
});

test('frontend admin detection requires the stored admin flag', () => {
	expect(isAdminUser({ email: 'ctw@ctwhome.com' })).toBe(false);
	expect(isAdminUser({ email: 'user@example.com', is_admin: true })).toBe(true);
	expect(isAdminUser(null)).toBe(false);
});
