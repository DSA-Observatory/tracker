/// <reference path="../pb_data/types.d.ts" />

const csvImportFields = [
	{ name: 'outcome', type: 'text', required: false, max: 240, min: 0, pattern: '' },
	{ name: 'courts', type: 'json', required: false, maxSize: 2000000 },
	{ name: 'legal_areas', type: 'json', required: false, maxSize: 2000000 },
	{ name: 'legal_basis', type: 'json', required: false, maxSize: 2000000 },
	{ name: 'case_scope', type: 'text', required: false, max: 160, min: 0, pattern: '' },
	{ name: 'timeline', type: 'editor', required: false, maxSize: 0, convertURLs: true },
	{ name: 'categories', type: 'json', required: false, maxSize: 2000000 },
	{ name: 'themes', type: 'json', required: false, maxSize: 2000000 },
	{ name: 'primary_sources', type: 'json', required: false, maxSize: 2000000 },
	{ name: 'secondary_sources', type: 'json', required: false, maxSize: 2000000 },
	{ name: 'source_limitations', type: 'editor', required: false, maxSize: 0, convertURLs: true },
	{ name: 'editorial_notes', type: 'editor', required: false, maxSize: 0, convertURLs: true }
];

function findField(fields, name) {
	try {
		return fields.getByName(name);
	} catch (e) {
		return null;
	}
}

migrate(
	(app) => {
		const cases = app.findCollectionByNameOrId('cases');

		for (const field of csvImportFields) {
			if (findField(cases.fields, field.name)) continue;
			cases.fields.add(new Field({ ...field, hidden: false, presentable: false }));
		}

		const status = findField(cases.fields, 'status');
		if (status && status.values && !status.values.includes('archived'))
			status.values.push('archived');

		app.save(cases);
	},
	() => {}
);
