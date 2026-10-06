/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const adminRule = "@request.auth.id != '' && @request.auth.is_admin = true";
		const feedback = app.findCollectionByNameOrId('website_feedback');

		try {
			feedback.fields.getByName('resolved');
		} catch {
			feedback.fields.add(
				new Field({
					name: 'resolved',
					type: 'bool',
					required: false,
					hidden: false,
					presentable: false
				})
			);
		}

		feedback.listRule = adminRule;
		feedback.viewRule = adminRule;
		feedback.createRule = '@request.body.message != "" && @request.body.resolved != true';
		feedback.updateRule = adminRule;
		feedback.deleteRule = null;
		app.save(feedback);
	},
	() => {
		// Preserve feedback records and their resolution state; removal requires a deliberate migration.
	}
);
