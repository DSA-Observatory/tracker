/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		try {
			app.findCollectionByNameOrId('website_feedback');
			return;
		} catch {
			// Create the private feedback collection below.
		}

		const adminRule = "@request.auth.id != '' && @request.auth.is_admin = true";
		const feedback = new Collection({
			name: 'website_feedback',
			type: 'base',
			system: false,
			listRule: adminRule,
			viewRule: adminRule,
			createRule: '@request.body.message != ""',
			updateRule: null,
			deleteRule: null,
			fields: [
				{
					name: 'message',
					type: 'text',
					required: true,
					min: 1,
					max: 5000,
					pattern: '',
					hidden: false,
					presentable: true
				},
				{
					name: 'contact',
					type: 'email',
					required: false,
					exceptDomains: [],
					onlyDomains: [],
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
				}
			],
			indexes: ['CREATE INDEX idx_website_feedback_created ON website_feedback (created)']
		});

		app.save(feedback);
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('website_feedback'));
		} catch {
			// The collection was already removed.
		}
	}
);
