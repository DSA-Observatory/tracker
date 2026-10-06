/// <reference path="../pb_data/types.d.ts" />

const workbookMetadataFields = [
	{
		name: 'decision_reference',
		type: 'text',
		required: false,
		max: 4000,
		min: 0,
		pattern: '',
		hidden: false,
		presentable: false
	},
	{
		name: 'procedural_wording',
		type: 'text',
		required: false,
		max: 4000,
		min: 0,
		pattern: '',
		hidden: false,
		presentable: false
	},
	{
		name: 'workbook_source',
		type: 'json',
		required: false,
		maxSize: 2000000,
		hidden: true,
		presentable: false
	}
];

function findField(fields, name) {
	try {
		return fields.getByName(name);
	} catch {
		return null;
	}
}

migrate(
	(app) => {
		const cases = app.findCollectionByNameOrId('cases');
		for (const field of workbookMetadataFields) {
			if (!findField(cases.fields, field.name)) cases.fields.add(new Field(field));
		}
		app.save(cases);
	},
	() => {
		// Keep imported provenance and references on rollback; removal requires a deliberate migration.
	}
);
