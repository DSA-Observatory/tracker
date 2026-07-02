/// <reference path="../pb_data/types.d.ts" />

function collectionExists(app, name) {
	try {
		return app.findCollectionByNameOrId(name);
	} catch (e) {
		return null;
	}
}

migrate(
	(app) => {
		if (collectionExists(app, 'link_checks')) return;

		const linkChecks = new Collection({
			name: 'link_checks',
			type: 'base',
			system: false,
			listRule: "@request.auth.id != ''",
			viewRule: "@request.auth.id != ''",
			createRule: "@request.auth.id != ''",
			updateRule: "@request.auth.id != ''",
			deleteRule: "@request.auth.id != ''",
			fields: [
				{
					name: 'run_id',
					type: 'text',
					required: true,
					max: 80,
					min: 1,
					pattern: '',
					hidden: false,
					presentable: false
				},
				{
					name: 'case_record_id',
					type: 'text',
					required: true,
					max: 80,
					min: 1,
					pattern: '',
					hidden: false,
					presentable: false
				},
				{
					name: 'case_id',
					type: 'text',
					required: false,
					max: 120,
					min: 0,
					pattern: '',
					hidden: false,
					presentable: true
				},
				{
					name: 'case_title',
					type: 'text',
					required: false,
					max: 300,
					min: 0,
					pattern: '',
					hidden: false,
					presentable: false
				},
				{
					name: 'source_field',
					type: 'text',
					required: true,
					max: 80,
					min: 1,
					pattern: '',
					hidden: false,
					presentable: false
				},
				{
					name: 'url',
					type: 'url',
					required: true,
					exceptDomains: [],
					onlyDomains: [],
					hidden: false,
					presentable: true
				},
				{
					name: 'status_code',
					type: 'text',
					required: false,
					max: 16,
					min: 0,
					pattern: '',
					hidden: false,
					presentable: false
				},
				{ name: 'ok', type: 'bool', required: false, hidden: false, presentable: false },
				{
					name: 'error',
					type: 'text',
					required: false,
					max: 500,
					min: 0,
					pattern: '',
					hidden: false,
					presentable: false
				},
				{
					name: 'checked_at',
					type: 'date',
					required: true,
					min: '',
					max: '',
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
				'CREATE INDEX idx_link_checks_run_id ON link_checks (run_id)',
				'CREATE INDEX idx_link_checks_case_record_id ON link_checks (case_record_id)',
				'CREATE INDEX idx_link_checks_ok ON link_checks (ok)',
				'CREATE INDEX idx_link_checks_checked_at ON link_checks (checked_at)'
			]
		});

		app.save(linkChecks);
	},
	(app) => {
		const linkChecks = collectionExists(app, 'link_checks');
		if (linkChecks) app.delete(linkChecks);
	}
);
