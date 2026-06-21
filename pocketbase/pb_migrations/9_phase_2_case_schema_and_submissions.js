/// <reference path="../pb_data/types.d.ts" />

const phase2CaseFields = [
	{ name: 'outcome', type: 'text', required: false, max: 240, min: 0, pattern: '' },
	{ name: 'courts', type: 'json', required: false, maxSize: 2000000 },
	{ name: 'legal_areas', type: 'json', required: false, maxSize: 2000000 },
	{ name: 'legal_basis', type: 'json', required: false, maxSize: 2000000 },
	{ name: 'case_scope', type: 'text', required: false, max: 160, min: 0, pattern: '' },
	{ name: 'procedural_events', type: 'json', required: false, maxSize: 2000000 },
	{ name: 'source_limitations', type: 'editor', required: false, maxSize: 0, convertURLs: true },
	{ name: 'editorial_notes', type: 'editor', required: false, maxSize: 0, convertURLs: true },
	{ name: 'submitted_by', type: 'text', required: false, max: 240, min: 0, pattern: '' }
];

function findField(fields, name) {
	try {
		return fields.getByName(name);
	} catch (e) {
		return null;
	}
}

function collectionExists(app, name) {
	try {
		return app.findCollectionByNameOrId(name);
	} catch (e) {
		return null;
	}
}

migrate(
	(app) => {
		const cases = app.findCollectionByNameOrId('cases');

		for (const field of phase2CaseFields) {
			if (findField(cases.fields, field.name)) continue;
			cases.fields.add(new Field({ ...field, hidden: false, presentable: false }));
		}

		const status = findField(cases.fields, 'status');
		if (status && status.values && !status.values.includes('archived')) {
			status.values.push('archived');
		}

		app.save(cases);

		if (collectionExists(app, 'case_submissions')) return;

		const submissions = new Collection({
			name: 'case_submissions',
			type: 'base',
			system: false,
			listRule: "@request.auth.id != ''",
			viewRule: "@request.auth.id != ''",
			createRule: '',
			updateRule: "@request.auth.id != ''",
			deleteRule: "@request.auth.id != ''",
			fields: [
				{
					name: 'title',
					type: 'text',
					required: true,
					max: 300,
					min: 1,
					pattern: '',
					hidden: false,
					presentable: true
				},
				{
					name: 'jurisdiction',
					type: 'text',
					required: false,
					max: 160,
					min: 0,
					pattern: '',
					hidden: false,
					presentable: false
				},
				{
					name: 'court',
					type: 'text',
					required: false,
					max: 240,
					min: 0,
					pattern: '',
					hidden: false,
					presentable: false
				},
				{
					name: 'parties',
					type: 'text',
					required: false,
					max: 600,
					min: 0,
					pattern: '',
					hidden: false,
					presentable: false
				},
				{
					name: 'case_url',
					type: 'url',
					required: false,
					exceptDomains: [],
					onlyDomains: [],
					hidden: false,
					presentable: false
				},
				{
					name: 'summary',
					type: 'editor',
					required: false,
					maxSize: 0,
					convertURLs: true,
					hidden: false,
					presentable: false
				},
				{
					name: 'submitter_name',
					type: 'text',
					required: false,
					max: 240,
					min: 0,
					pattern: '',
					hidden: false,
					presentable: false
				},
				{
					name: 'submitter_email',
					type: 'email',
					required: false,
					exceptDomains: [],
					onlyDomains: [],
					hidden: false,
					presentable: false
				},
				{
					name: 'status',
					type: 'select',
					required: true,
					maxSelect: 1,
					values: ['new', 'review', 'accepted', 'rejected', 'archived'],
					hidden: false,
					presentable: false
				},
				{
					name: 'editorial_notes',
					type: 'editor',
					required: false,
					maxSize: 0,
					convertURLs: true,
					hidden: false,
					presentable: false
				},
				{
					name: 'created',
					type: 'autodate',
					onCreate: true,
					onUpdate: false,
					hidden: false,
					presentable: false
				},
				{
					name: 'updated',
					type: 'autodate',
					onCreate: true,
					onUpdate: true,
					hidden: false,
					presentable: false
				}
			],
			indexes: [
				'CREATE INDEX idx_case_submissions_status ON case_submissions (status)',
				'CREATE INDEX idx_case_submissions_created ON case_submissions (created)'
			]
		});

		app.save(submissions);
	},
	(app) => {
		const cases = app.findCollectionByNameOrId('cases');
		for (const field of phase2CaseFields) {
			const existing = findField(cases.fields, field.name);
			if (existing) cases.fields.removeById(existing.id);
		}
		app.save(cases);

		const submissions = collectionExists(app, 'case_submissions');
		if (submissions) app.delete(submissions);
	}
);
