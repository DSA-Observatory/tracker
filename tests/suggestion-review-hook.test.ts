import { expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

type Values = Record<string, unknown>;

class FakeRecord {
	id: string;
	values: Values;

	constructor(collection: { nextId?: string }, values: Values = {}) {
		this.id = String(values.id ?? collection.nextId ?? 'draft-case');
		this.values = { ...values };
	}

	get(field: string) {
		return this.values[field];
	}

	getString(field: string) {
		return typeof this.values[field] === 'string' ? (this.values[field] as string) : '';
	}

	getStringSlice(field: string) {
		const value = this.values[field];
		return Array.isArray(value) ? [...value] : [];
	}

	getBool(field: string) {
		return this.values[field] === true;
	}

	set(field: string, value: unknown) {
		this.values[field] = value;
	}

	collection() {
		return { name: String(this.values.collection ?? 'users') };
	}
}

type Route = {
	method: string;
	path: string;
	handler: (event: ReviewEvent) => void;
	middleware: unknown;
};

type ReviewEvent = ReturnType<typeof createEvent>['event'];

const hookSource = await readFile(
	new URL('../pocketbase/pb_hooks/case_submission_workflow.pb.js', import.meta.url),
	'utf8'
);

function registerRoute() {
	let route: Route | undefined;
	const requireAuth = Symbol('requireAuth');
	runInNewContext(hookSource, {
		Record: FakeRecord,
		onRecordCreateRequest() {},
		onRecordUpdateRequest() {},
		routerAdd(method: string, path: string, handler: Route['handler'], middleware: unknown) {
			route = { method, path, handler, middleware };
		},
		$apis: { requireAuth: () => requireAuth }
	});

	expect(Boolean(route)).toBe(true);
	return { route: route!, requireAuth };
}

function createAuth({ collection = 'users', isAdmin = false, email = 'user@example.com' } = {}) {
	return new FakeRecord({}, { id: 'reviewer', collection, is_admin: isAdmin, email });
}

function submissionValues(overrides: Values = {}) {
	return {
		id: 'submission-1',
		status: 'pending',
		resulting_case: '',
		title: 'A & B',
		decision_date: '2026-01-02',
		jurisdiction: 'EU',
		court: 'Court',
		plaintiffs: ['Alice'],
		defendants: ['Platform'],
		dsa_articles: ['14'],
		document_links: ['https://example.com/document', 'https://example.com/case'],
		case_url: 'https://example.com/case',
		summary: `<p class="lead">O'Reilly & partners</p>`,
		...overrides
	};
}

function createEvent({
	auth = createAuth({ isAdmin: true }),
	body = { decision: 'accepted' },
	submission = new FakeRecord({}, submissionValues()),
	existingCase = null,
	lookupError = null
}: {
	auth?: FakeRecord | null;
	body?: Values;
	submission?: FakeRecord;
	existingCase?: FakeRecord | null;
	lookupError?: Error | null;
} = {}) {
	const cases: FakeRecord[] = existingCase ? [existingCase] : [];
	const saves: FakeRecord[] = [];
	let response: { status: number; body: Values } | undefined;
	let transactions = 0;

	const txApp = {
		findRecordById(collection: string, id: string) {
			if (collection === 'case_submissions' && id === submission.id) return submission;
			if (collection === 'cases') {
				const found = cases.find((record) => record.id === id);
				if (found) return found;
			}
			throw new Error('record not found');
		},
		findRecordsByFilter(
			collection: string,
			filter: string,
			sort: string,
			limit: number,
			offset: number,
			params: Values
		) {
			expect(collection).toBe('cases');
			expect(filter).toBe('submitted_by = {:submission}');
			expect(sort).toBe('');
			expect(limit).toBe(1);
			expect(offset).toBe(0);
			expect(params.submission).toBe(submission.id);
			if (lookupError) throw lookupError;
			return cases.filter((record) => record.getString('submitted_by') === params.submission);
		},
		findCollectionByNameOrId(name: string) {
			expect(name).toBe('cases');
			return { nextId: `draft-${cases.length + 1}` };
		},
		save(record: FakeRecord) {
			saves.push(record);
			if (record !== submission && !cases.includes(record)) cases.push(record);
		}
	};

	const event = {
		auth,
		requestInfo: () => ({ body }),
		request: { pathValue: (name: string) => (name === 'id' ? submission.id : '') },
		app: {
			runInTransaction(callback: (app: typeof txApp) => void) {
				transactions += 1;
				callback(txApp);
			}
		},
		forbiddenError(message: string) {
			return Object.assign(new Error(message), { status: 403 });
		},
		badRequestError(message: string) {
			return Object.assign(new Error(message), { status: 400 });
		},
		json(status: number, bodyValue: Values) {
			response = { status, body: bodyValue };
		}
	};

	return {
		event,
		submission,
		cases,
		saves,
		getResponse: () => response,
		getTransactions: () => transactions
	};
}

function thrownBy(run: () => unknown) {
	try {
		run();
		return null;
	} catch (error) {
		return error as Error & { status?: number };
	}
}

test('registers the decision route with authentication middleware', () => {
	const { route, requireAuth } = registerRoute();
	expect(route.method).toBe('PATCH');
	expect(route.path).toBe('/api/admin/submissions/{id}/decision');
	expect(route.middleware).toBe(requireAuth);
});

test('review decisions require a flagged users record', () => {
	const { route } = registerRoute();
	const identities = [
		null,
		createAuth(),
		createAuth({ email: 'ctw@ctwhome.com' }),
		createAuth({ collection: '_superusers', isAdmin: true })
	];

	for (const auth of identities) {
		const request = createEvent({ auth });
		const error = thrownBy(() => route.handler(request.event));
		expect(error?.message).toBe('Admin access required.');
		expect(error?.status).toBe(403);
		expect(request.getTransactions()).toBe(0);
	}
});

test('acceptance atomically creates a private draft preserving source metadata safely', () => {
	const { route } = registerRoute();
	const request = createEvent();

	route.handler(request.event);

	expect(request.getTransactions()).toBe(1);
	expect(request.cases.length).toBe(1);
	const draft = request.cases[0];
	expect(draft.getString('case_id')).toBe('suggestion-submission-1');
	expect(draft.getString('status')).toBe('draft');
	expect(draft.getBool('published')).toBe(false);
	expect(draft.get('plaintiffs')).toEqual(['Alice']);
	expect(draft.get('defendants')).toEqual(['Platform']);
	expect(draft.get('dsa_articles')).toEqual(['14']);
	expect(draft.get('document_links')).toEqual([
		'https://example.com/document',
		'https://example.com/case'
	]);
	expect(draft.getString('summary')).toBe(
		'&lt;p class=&quot;lead&quot;&gt;O&#39;Reilly &amp; partners&lt;/p&gt;'
	);
	expect(request.submission.getString('status')).toBe('accepted');
	expect(request.submission.getString('resulting_case')).toBe(draft.id);
	expect(request.submission.getString('decided_by')).toBe('reviewer');
	expect(request.saves.length).toBe(2);
	expect(request.getResponse()?.status).toBe(200);
});

test('acceptance preserves a case URL when it is the only source', () => {
	const { route } = registerRoute();
	const submission = new FakeRecord(
		{},
		submissionValues({ document_links: [], case_url: 'https://example.com/case-only' })
	);
	const request = createEvent({ submission });

	route.handler(request.event);

	expect(request.cases.length).toBe(1);
	expect(request.cases[0].get('document_links')).toEqual(['https://example.com/case-only']);
});

test('case lookup failures propagate without creating or saving records', () => {
	const { route } = registerRoute();
	const lookupError = new Error('database unavailable');
	const request = createEvent({ lookupError });

	const error = thrownBy(() => route.handler(request.event));

	expect(error).toBe(lookupError);
	expect(request.cases.length).toBe(0);
	expect(request.saves.length).toBe(0);
	expect(request.submission.getString('status')).toBe('pending');
	expect(request.getResponse()).toBe(undefined);
});

test('accepted retries return the same draft without creating or saving another', () => {
	const { route } = registerRoute();
	const draft = new FakeRecord({}, { id: 'draft-existing', submitted_by: 'submission-1' });
	const submission = new FakeRecord(
		{},
		submissionValues({ status: 'accepted', resulting_case: draft.id })
	);
	const request = createEvent({ submission, existingCase: draft });

	route.handler(request.event);
	route.handler(request.event);

	expect(request.cases.length).toBe(1);
	expect(request.saves.length).toBe(0);
	expect(request.getResponse()?.body.case).toBe(draft);
});

test('a rejected suggestion cannot later be accepted', () => {
	const { route } = registerRoute();
	const submission = new FakeRecord({}, submissionValues({ status: 'rejected' }));
	const request = createEvent({ submission });

	const error = thrownBy(() => route.handler(request.event));
	expect(error?.message).toBe('This suggestion already has a final decision.');
	expect(error?.status).toBe(400);
	expect(request.cases.length).toBe(0);
	expect(request.saves.length).toBe(0);
});

test('malformed decisions fail before starting a transaction', () => {
	const { route } = registerRoute();
	for (const decision of [undefined, null, '', 'approve', true]) {
		const request = createEvent({ body: decision === undefined ? {} : { decision } });
		const error = thrownBy(() => route.handler(request.event));
		expect(error?.message).toBe('Decision must be accepted or rejected.');
		expect(error?.status).toBe(400);
		expect(request.getTransactions()).toBe(0);
	}
});

test('migration 17 tightens rules without reading or mutating historical records', async () => {
	const migrationSource = await readFile(
		new URL('../pocketbase/pb_migrations/17_admin_only_suggestion_review.js', import.meta.url),
		'utf8'
	);
	let up: ((app: Values) => void) | undefined;
	const submissions: Values = {};
	const comments: Values = {};
	const saved: Values[] = [];
	let historicalReads = 0;

	runInNewContext(migrationSource, {
		migrate(upCallback: (app: Values) => void) {
			up = upCallback;
		}
	});
	expect(Boolean(up)).toBe(true);
	up!({
		findCollectionByNameOrId(name: unknown) {
			return name === 'case_submissions' ? submissions : comments;
		},
		findRecordsByFilter() {
			historicalReads += 1;
			return [];
		},
		save(collection: Values) {
			saved.push(collection);
		}
	});

	const rule = "@request.auth.id != '' && @request.auth.is_admin = true";
	expect(submissions.listRule).toBe(rule);
	expect(submissions.viewRule).toBe(rule);
	expect(submissions.createRule).toBe('');
	expect(submissions.updateRule).toBe(null);
	expect(submissions.deleteRule).toBe(null);
	expect(comments.createRule).toBe(rule);
	expect(comments.deleteRule).toBe(rule);
	expect(historicalReads).toBe(0);
	expect(saved).toEqual([submissions, comments]);
});
