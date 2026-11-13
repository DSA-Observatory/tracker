/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const cases = app.findCollectionByNameOrId('cases');
		if (!cases.fields.getByName('related_cases'))
			cases.fields.add(
				new Field({
					name: 'related_cases',
					type: 'relation',
					collectionId: cases.id,
					cascadeDelete: false,
					maxSelect: 100,
					required: false,
					hidden: false,
					presentable: false
				})
			);
		if (!cases.fields.getByName('document_order'))
			cases.fields.add(
				new Field({
					name: 'document_order',
					type: 'json',
					maxSize: 2000000,
					required: false,
					hidden: false,
					presentable: false
				})
			);
		app.save(cases);
	},
	(app) => {
		const cases = app.findCollectionByNameOrId('cases');
		for (const name of ['related_cases', 'document_order']) {
			const field = cases.fields.getByName(name);
			if (field) cases.fields.removeById(field.id);
		}
		app.save(cases);
	}
);
