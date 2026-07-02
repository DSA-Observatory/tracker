/// <reference path="../pb_data/types.d.ts" />

const documentMimeTypes = [
	'application/pdf',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'text/plain',
	'text/html',
	'image/jpeg',
	'image/png',
	'image/webp'
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
		const documents = findField(cases.fields, 'documents');

		if (!documents) {
			cases.fields.add(
				new Field({
					name: 'documents',
					type: 'file',
					required: false,
					maxSelect: 20,
					maxSize: 52428800,
					mimeTypes: documentMimeTypes,
					thumbs: [],
					protected: false,
					hidden: false,
					presentable: false
				})
			);
		} else {
			documents.maxSelect = 20;
			documents.maxSize = 52428800;
			documents.mimeTypes = documentMimeTypes;
			documents.protected = false;
		}

		app.save(cases);
	},
	(app) => {
		const cases = app.findCollectionByNameOrId('cases');
		const documents = findField(cases.fields, 'documents');
		if (!documents) return;

		documents.mimeTypes = [
			'application/pdf',
			'text/plain',
			'text/html',
			'image/jpeg',
			'image/png',
			'image/webp'
		];

		app.save(cases);
	}
);
