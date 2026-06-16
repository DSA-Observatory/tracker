#!/usr/bin/env bun

import PocketBase from 'pocketbase';

const pocketbaseUrl =
	process.env.POCKETBASE_PROD_URL ||
	process.env.POCKETBASE_URL ||
	process.env.PUBLIC_POCKETBASE_URL ||
	'http://localhost:8095';
const adminEmail = process.env.POCKETBASE_SUPERUSER_EMAIL || process.env.POCKETBASE_ADMIN_EMAIL;
const adminPassword =
	process.env.POCKETBASE_SUPERUSER_PASSWORD || process.env.POCKETBASE_ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
	throw new Error('POCKETBASE_SUPERUSER_EMAIL and POCKETBASE_SUPERUSER_PASSWORD are required.');
}

const collection = {
	name: 'cases',
	type: 'base',
	system: false,
	listRule: "published = true || @request.auth.id != ''",
	viewRule: "published = true || @request.auth.id != ''",
	createRule: "@request.auth.id != ''",
	updateRule: "@request.auth.id != ''",
	deleteRule: "@request.auth.id != ''",
	fields: [
		{
			name: 'case_id',
			type: 'text',
			required: true,
			max: 80,
			min: 1,
			pattern: '',
			presentable: true
		},
		{
			name: 'title',
			type: 'text',
			required: true,
			max: 300,
			min: 1,
			pattern: '',
			presentable: true
		},
		{ name: 'ecli', type: 'text', required: false, max: 160, min: 0, pattern: '' },
		{ name: 'filing_date', type: 'date', required: false, min: '', max: '' },
		{ name: 'decision_date', type: 'date', required: false, min: '', max: '' },
		{
			name: 'status',
			type: 'select',
			required: true,
			maxSelect: 1,
			values: ['draft', 'review', 'pending', 'decided', 'appealed', 'closed', 'published']
		},
		{ name: 'court', type: 'text', required: false, max: 240, min: 0, pattern: '' },
		{ name: 'jurisdiction', type: 'text', required: false, max: 160, min: 0, pattern: '' },
		{ name: 'plaintiffs', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'defendants', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'summary', type: 'editor', required: false, maxSize: 0, convertURLs: true },
		{ name: 'keywords', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'dsa_articles', type: 'json', required: false, maxSize: 2000000 },
		{
			name: 'documents',
			type: 'file',
			required: false,
			maxSelect: 20,
			maxSize: 52428800,
			mimeTypes: [
				'application/pdf',
				'text/plain',
				'text/html',
				'image/jpeg',
				'image/png',
				'image/webp'
			],
			thumbs: [],
			protected: false
		},
		{ name: 'document_links', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'citations_to', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'cited_by', type: 'json', required: false, maxSize: 2000000 },
		{ name: 'commentary', type: 'editor', required: false, maxSize: 0, convertURLs: true },
		{ name: 'published', type: 'bool', required: false },
		{ name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
		{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
	],
	indexes: [
		'CREATE UNIQUE INDEX idx_cases_case_id ON cases (case_id)',
		'CREATE INDEX idx_cases_published ON cases (published)',
		'CREATE INDEX idx_cases_status ON cases (status)',
		'CREATE INDEX idx_cases_jurisdiction ON cases (jurisdiction)',
		'CREATE INDEX idx_cases_decision_date ON cases (decision_date)',
		'CREATE INDEX idx_cases_title ON cases (title)'
	]
};

async function authenticate(pb: PocketBase) {
	try {
		await pb.collection('_superusers').authWithPassword(adminEmail!, adminPassword!);
	} catch (err) {
		await pb.admins.authWithPassword(adminEmail!, adminPassword!);
	}
}

async function main() {
	const pb = new PocketBase(pocketbaseUrl);
	pb.autoCancellation(false);

	await authenticate(pb);

	try {
		await pb.collections.getOne('cases');
		console.log('Cases collection already exists. No changes applied.');
		return;
	} catch (err) {
		// Missing collection; create it below.
	}

	await pb.collections.create(collection);
	console.log('Cases collection created.');
}

main().catch((err) => {
	console.error('Failed to apply cases collection:', err?.response ?? err);
	process.exit(1);
});
