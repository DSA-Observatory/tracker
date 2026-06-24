#!/usr/bin/env bun

import PocketBase from 'pocketbase';

const pocketbaseUrl =
	process.env.POCKETBASE_TARGET_URL ||
	process.env.POCKETBASE_PROD_URL ||
	process.env.POCKETBASE_URL ||
	process.env.PUBLIC_POCKETBASE_URL ||
	'http://localhost:46218';
const adminEmail = process.env.POCKETBASE_SUPERUSER_EMAIL || process.env.POCKETBASE_ADMIN_EMAIL;
const adminPassword = process.env.POCKETBASE_SUPERUSER_PASSWORD || process.env.POCKETBASE_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
	throw new Error('POCKETBASE_SUPERUSER_EMAIL and POCKETBASE_SUPERUSER_PASSWORD are required.');
}

const caseSubmissionsCollection = {
	name: 'case_submissions',
	type: 'base',
	system: false,
	listRule: "@request.auth.id != ''",
	viewRule: "@request.auth.id != ''",
	createRule: '',
	updateRule: "@request.auth.id != ''",
	deleteRule: "@request.auth.id != ''",
	fields: [
		{ name: 'case_id', type: 'text', required: false, max: 80, min: 0, pattern: '' },
		{ name: 'title', type: 'text', required: true, max: 300, min: 1, pattern: '', presentable: true },
		{ name: 'ecli', type: 'text', required: false, max: 160, min: 0, pattern: '' },
		{ name: 'filing_date', type: 'date', required: false, min: '', max: '' },
		{ name: 'decision_date', type: 'date', required: false, min: '', max: '' },
		{
			name: 'case_status',
			type: 'select',
			required: false,
			maxSelect: 1,
			values: ['draft', 'review', 'pending', 'decided', 'appealed', 'closed', 'archived', 'published']
		},
		{ name: 'outcome', type: 'text', required: false, max: 240, min: 0, pattern: '' },
		{ name: 'jurisdiction', type: 'text', required: false, max: 160, min: 0, pattern: '' },
		{ name: 'court', type: 'text', required: false, max: 240, min: 0, pattern: '' },
		{ name: 'courts', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'plaintiffs', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'defendants', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'parties', type: 'text', required: false, max: 600, min: 0, pattern: '' },
		{ name: 'legal_areas', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'legal_basis', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'case_scope', type: 'text', required: false, max: 160, min: 0, pattern: '' },
		{ name: 'procedural_events', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'timeline', type: 'editor', required: false, maxSize: 0, convertURLs: true },
		{ name: 'categories', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'themes', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'primary_sources', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'secondary_sources', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'keywords', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'dsa_articles', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'document_links', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'case_url', type: 'url', required: false, exceptDomains: [], onlyDomains: [] },
		{ name: 'summary', type: 'editor', required: false, maxSize: 0, convertURLs: true },
		{ name: 'source_limitations', type: 'editor', required: false, maxSize: 0, convertURLs: true },
		{ name: 'submitter_name', type: 'text', required: false, max: 240, min: 0, pattern: '' },
		{ name: 'submitter_email', type: 'email', required: false, exceptDomains: [], onlyDomains: [] },
		{
			name: 'status',
			type: 'select',
			required: true,
			maxSelect: 1,
			values: ['new', 'review', 'accepted', 'rejected', 'archived']
		},
		{ name: 'editorial_notes', type: 'editor', required: false, maxSize: 0, convertURLs: true },
		{ name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
		{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
	],
	indexes: [
		'CREATE INDEX idx_case_submissions_status ON case_submissions (status)',
		'CREATE INDEX idx_case_submissions_created ON case_submissions (created)'
	]
};

async function authenticate(pb: PocketBase) {
	try {
		await pb.collection('_superusers').authWithPassword(adminEmail!, adminPassword!);
	} catch {
		await pb.admins.authWithPassword(adminEmail!, adminPassword!);
	}
}

async function main() {
	const pb = new PocketBase(pocketbaseUrl);
	pb.autoCancellation(false);

	await authenticate(pb);

	try {
		const existing = await pb.collections.getOne('case_submissions');
		const existingFieldNames = new Set(existing.fields.map((field: { name: string }) => field.name));
		const missingFields = caseSubmissionsCollection.fields.filter(
			(field) => !existingFieldNames.has(field.name)
		);

		if (!missingFields.length) {
			console.log('case_submissions collection already exists.');
			return;
		}

		await pb.collections.update(existing.id, {
			fields: [...existing.fields, ...missingFields],
			indexes: caseSubmissionsCollection.indexes
		});
		console.log(`case_submissions collection updated with ${missingFields.length} field(s).`);
		return;
	} catch {
		await pb.collections.create(caseSubmissionsCollection);
		console.log('case_submissions collection created.');
	}
}

main().catch((err) => {
	console.error('Failed to apply phase 2 schema:', err?.response ?? err);
	process.exit(1);
});
