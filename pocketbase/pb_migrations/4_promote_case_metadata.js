/// <reference path="../pb_data/types.d.ts" />

const promotedFields = [
	{ name: 'timeline', type: 'editor', required: false, maxSize: 0, convertURLs: true },
	{ name: 'categories', type: 'json', required: false, maxSize: 2000000 },
	{ name: 'themes', type: 'json', required: false, maxSize: 2000000 },
	{ name: 'primary_sources', type: 'json', required: false, maxSize: 2000000 },
	{ name: 'secondary_sources', type: 'json', required: false, maxSize: 2000000 }
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

		for (const field of promotedFields) {
			if (findField(cases.fields, field.name)) continue;
			cases.fields.add(new Field(field));
		}

		app.save(cases);
	},
	(app) => {
		const cases = app.findCollectionByNameOrId('cases');

		for (const field of promotedFields) {
			const existing = findField(cases.fields, field.name);
			if (existing) cases.fields.removeById(existing.id);
		}

		app.save(cases);
	}
);
