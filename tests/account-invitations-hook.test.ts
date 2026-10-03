import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { createHash, timingSafeEqual } from 'node:crypto';
import { runInNewContext } from 'node:vm';

type Values = Record<string, unknown>;
const source = await readFile(
	new URL('../pocketbase/pb_hooks/account_invitations.pb.js', import.meta.url),
	'utf8'
);
const migrationSource = await readFile(
	new URL('../pocketbase/pb_migrations/18_account_invitations.js', import.meta.url),
	'utf8'
);
const secret = 'S'.repeat(64);
const hash = (text: string) => createHash('sha256').update(text).digest('hex');

class FakeRecord {
	id: string;
	values: Values;
	constructor(collection: { name?: string } = {}, values: Values = {}) {
		this.id = String(values.id || 'invitation-1');
		this.values = { collection: collection.name || 'account_invitations', ...values };
	}
	getString(field: string) {
		return String(this.values[field] || '');
	}
	getBool(field: string) {
		return this.values[field] === true;
	}
	set(field: string, value: unknown) {
		this.values[field] = value;
	}
	email() {
		return this.getString('email');
	}
	tokenKey() {
		return this.getString('tokenKey');
	}
	setEmail(value: string) {
		this.set('email', value);
	}
	setVerified(value: boolean) {
		this.set('verified', value);
	}
	setPassword(value: string) {
		this.set('password', value);
		this.set('tokenKey', 'changed-key');
	}
	collection() {
		return { name: this.getString('collection') };
	}
	publicExport() {
		return { id: this.id, ...this.values };
	}
}

function harness({ minimum = 8, failSave = false } = {}) {
	const user = new FakeRecord(
		{ name: 'users' },
		{
			id: 'member-1',
			email: 'member@example.com',
			name: 'Member',
			tokenKey: 'original-key',
			password: 'old-password',
			is_admin: true,
			verified: false,
			updated: '2026-10-02 10:00:00.000Z'
		}
	);
	const invitation = new FakeRecord(
		{},
		{
			user: user.id,
			email: user.email(),
			token_hash: hash(secret),
			token_key_hash: hash(user.tokenKey()),
			state: 'pending',
			purpose: 'recovery',
			updated: '2026-10-02 09:00:00.000Z'
		}
	);
	const records = [invitation];
	const store = new Map<string, Values>();
	const routes = new Map<string, { handler: (e: Event) => void; middleware: unknown[] }>();
	let updateHook:
		| ((e: { app: typeof app; record: FakeRecord; next: () => void }) => void)
		| undefined;
	let now = 1_000_000;
	let saves = 0;
	let response: { status: number; body?: Values } | undefined;
	const auth = new FakeRecord({ name: 'users' }, { id: 'admin-1', is_admin: true });
	const app = {
		store: () => ({
			setFunc(key: string, callback: (previous?: Values) => Values) {
				store.set(key, callback(store.get(key)));
			}
		}),
		findCollectionByNameOrId: (name: string) => ({
			name,
			fields: { getByName: () => ({ min: minimum }) }
		}),
		findAuthRecordByEmail: () => user,
		findRecordById(collection: string, id: string) {
			if (collection === 'users' && id === user.id) return user;
			const found = records.find((record) => record.id === id);
			if (found) return found;
			throw new Error('not found');
		},
		findFirstRecordByFilter(_collection: string, _filter: string, params: Values) {
			const found = records.find((record) =>
				params.tokenHash
					? record.getString('state') === 'pending' &&
						record.getString('token_hash') === params.tokenHash
					: record.getString('user') === params.user
			);
			if (found) return found;
			throw new Error('not found');
		},
		findRecordsByFilter(
			_collection: string,
			filter: string,
			_sort: string,
			limit: number,
			_offset: number,
			params?: Values
		) {
			const found = filter
				? records.filter(
						(record) =>
							record.getString('user') === params?.user && record.getString('state') === 'pending'
					)
				: records;
			return limit > 0 ? found.slice(0, limit) : found;
		},
		save(record: FakeRecord) {
			if (record === user && failSave)
				throw {
					password: { code: 'password_policy', message: 'Use the required password pattern.' }
				};
			saves++;
			if (record !== user && !records.includes(record)) records.push(record);
		},
		runInTransaction(callback: (tx: object) => void) {
			const original = [user, ...records].map((record) => ({
				record,
				values: { ...record.values }
			}));
			try {
				callback(app);
			} catch (error) {
				for (const item of original) item.record.values = item.values;
				throw error;
			}
		},
		settings: () => ({ meta: { senderAddress: 'test@example.com', senderName: 'Test' } }),
		newMailClient: () => ({
			send() {
				throw new Error('SMTP disabled');
			}
		})
	};
	const apiError = (status: number) => (message: string, details?: unknown) =>
		Object.assign(new Error(message), { status, details });
	const event = {
		auth: auth as FakeRecord | null,
		app,
		requestInfo: () => ({
			body: {
				invitation: secret,
				password: 'new-password',
				passwordConfirm: 'new-password'
			} as Values
		}),
		request: { pathValue: () => user.id },
		realIP: () => '127.0.0.1',
		forbiddenError: apiError(403),
		badRequestError: apiError(400),
		notFoundError: apiError(404),
		tooManyRequestsError: apiError(429),
		json(status: number, body: Values) {
			response = { status, body };
		},
		noContent(status: number) {
			response = { status };
		}
	};
	type Event = typeof event;
	const requireAuth = Symbol('requireAuth');
	runInNewContext(source, {
		Record: FakeRecord,
		MailerMessage: class {
			constructor(values: Values) {
				Object.assign(this, values);
			}
		},
		ValidationError: class {
			constructor(
				public code: string,
				public message: string
			) {}
		},
		Date: class extends Date {
			static now() {
				return now;
			}
		},
		$security: {
			sha256: hash,
			randomString: () => 'N'.repeat(64),
			equal: (a: string, b: string) =>
				a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
		},
		$os: { getenv: () => '' },
		$apis: { requireAuth: () => requireAuth, bodyLimit: (size: number) => size },
		onRecordAfterUpdateSuccess(callback: typeof updateHook) {
			updateHook = callback;
		},
		routerAdd(method: string, path: string, handler: (e: Event) => void, ...middleware: unknown[]) {
			routes.set(`${method} ${path}`, { handler, middleware });
		}
	});
	return {
		user,
		invitation,
		records,
		event,
		app,
		store,
		routes,
		requireAuth,
		run: (path: string) => routes.get(path)!.handler(event),
		response: () => response,
		saves: () => saves,
		advance: () => {
			now += 60_000;
		},
		update: (record = user) => updateHook!({ app, record, next() {} })
	};
}

test('all administrative invitation routes require a flagged users admin', () => {
	const h = harness();
	for (const [path, route] of h.routes) {
		if (!path.includes('/api/admin/')) continue;
		expect(route.middleware).toContain(h.requireAuth);
		for (const auth of [
			null,
			new FakeRecord({ name: 'users' }),
			new FakeRecord({ name: '_superusers' }, { is_admin: true })
		]) {
			h.event.auth = auth;
			expect(() => route.handler(h.event)).toThrow('Admin access required.');
		}
	}
	expect(h.saves()).toBe(0);
});

test('recovery preserves account identity and roles, and is consumed only once', () => {
	const h = harness();
	h.run('POST /api/account/setup');
	expect(h.response()?.status).toBe(204);
	expect(h.user.id).toBe('member-1');
	expect(h.user.getBool('is_admin')).toBe(true);
	expect(h.user.getString('password')).toBe('new-password');
	expect(h.invitation.getString('state')).toBe('used');
	expect(() => h.run('POST /api/account/setup')).toThrow('Unable to set up this account.');
});

test('configured password policy and failed saves never consume an invitation', () => {
	for (const options of [{ minimum: 20 }, { failSave: true }]) {
		const h = harness(options);
		expect(() => h.run('POST /api/account/setup')).toThrow();
		expect(h.invitation.getString('state')).toBe('pending');
		expect(h.user.getString('password')).toBe('old-password');
	}
});

test('changed binding prevents redemption and resend from reviving authorization', () => {
	const h = harness();
	h.user.set('tokenKey', 'changed-key');
	expect(() => h.run('POST /api/account/setup')).toThrow();
	expect(h.invitation.getString('state')).toBe('revoked');
	h.event.request.pathValue = () => h.invitation.id;
	expect(() => h.run('POST /api/admin/invitations/{id}/resend')).toThrow(
		'Invitation can no longer be resent.'
	);
});

test('only explicit admin recovery can create a fresh authorization after revocation', () => {
	const h = harness();
	h.invitation.set('state', 'revoked');
	h.run('POST /api/admin/users/{id}/recovery-invitation');
	expect(h.invitation.getString('state')).toBe('pending');
	expect(h.invitation.getString('purpose')).toBe('recovery');
	expect(h.user.getString('password')).toBe('old-password');
	expect(h.user.getBool('is_admin')).toBe(true);
	expect(h.response()?.body?.mailError).toBe('delivery_failed');
});

test('listing is observational, returns user IDs, and does not truncate at 500', () => {
	const h = harness();
	h.user.set('tokenKey', 'changed-key');
	for (let i = 0; i < 500; i++)
		h.records.push(new FakeRecord({}, { id: `older-${i}`, user: h.user.id, state: 'used' }));
	h.run('GET /api/admin/invitations');
	const items = h.response()?.body?.items as Values[];
	expect(items).toHaveLength(501);
	expect(items[0].user).toBe(h.user.id);
	expect(items[0].status).toBe('revoked');
	expect(h.invitation.getString('state')).toBe('pending');
	expect(h.saves()).toBe(0);
});

test('late update hooks preserve newer recovery links but revoke old links after email reversal', () => {
	const h = harness();
	const eventRecord = new FakeRecord(
		{ name: 'users' },
		{
			...h.user.values,
			id: h.user.id,
			email: 'changed@example.com',
			updated: '2026-10-02 10:00:00.000Z'
		}
	);
	h.invitation.set('updated', '2026-10-02 10:00:01.000Z');
	h.update(eventRecord);
	expect(h.invitation.getString('state')).toBe('pending');
	h.invitation.set('updated', '2026-10-02 09:00:00.000Z');
	h.update(eventRecord);
	expect(h.invitation.getString('state')).toBe('revoked');
});

test('throttling bounds memory, rejects excess attempts, and evicts expired windows', () => {
	const h = harness();
	h.event.requestInfo = () => ({
		body: { invitation: 'invalid', password: 'new-password', passwordConfirm: 'new-password' }
	});
	for (let i = 0; i < 10; i++)
		expect(() => h.run('POST /api/account/setup')).toThrow('Unable to set up this account.');
	expect(() => h.run('POST /api/account/setup')).toThrow('Too many setup attempts.');
	const windows: Values = {};
	for (let i = 0; i < 2048; i++) windows[`client-${i}`] = { startedAt: 1_000_000, attempts: 1 };
	h.store.set('account-setup:windows', windows);
	expect(() => h.run('POST /api/account/setup')).toThrow('Too many setup attempts.');
	expect(Object.keys(h.store.get('account-setup:windows')!)).toHaveLength(2048);
	h.advance();
	expect(() => h.run('POST /api/account/setup')).toThrow('Unable to set up this account.');
	expect(Object.keys(h.store.get('account-setup:windows')!)).toHaveLength(1);
});

test('migration locks invitation APIs and stores hashes without expiry', () => {
	let collection: Values | undefined;
	runInNewContext(migrationSource, {
		Collection: class {
			constructor(values: Values) {
				Object.assign(this, values);
			}
		},
		migrate(up: (app: unknown) => void) {
			up({
				findCollectionByNameOrId(name: string) {
					if (name === 'users') return { id: 'users-id' };
					throw new Error('not found');
				},
				save(value: Values) {
					collection = value;
				}
			});
		}
	});
	for (const rule of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'])
		expect(collection?.[rule]).toBeNull();
	const fields = collection?.fields as Values[];
	expect(fields.find((field) => field.name === 'token_hash')?.hidden).toBe(true);
	expect(fields.some((field) => /expir|secret|password/.test(String(field.name)))).toBe(false);
});
