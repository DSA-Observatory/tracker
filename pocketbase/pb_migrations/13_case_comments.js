/// <reference path="../pb_data/types.d.ts" />

const adminRule = '@request.auth.is_admin = true';

migrate(
	(app) => {
		try {
			app.findCollectionByNameOrId('case_comments');
			return;
		} catch (e) {
			// Create the collection below.
		}

		const cases = app.findCollectionByNameOrId('cases');
		const users = app.findCollectionByNameOrId('users');
		const comments = new Collection({
			name: 'case_comments',
			type: 'base',
			system: false,
			listRule: adminRule,
			viewRule: adminRule,
			createRule: adminRule,
			updateRule: adminRule,
			deleteRule: adminRule,
			fields: [
				{
					name: 'case',
					type: 'relation',
					required: true,
					options: { collectionId: cases.id, cascadeDelete: true, maxSelect: 1 },
					hidden: false,
					presentable: true
				},
				{
					name: 'author',
					type: 'relation',
					required: true,
					options: { collectionId: users.id, cascadeDelete: false, maxSelect: 1 },
					hidden: false,
					presentable: true
				},
				{
					name: 'content',
					type: 'text',
					required: true,
					min: 1,
					max: 4000,
					pattern: '',
					hidden: false,
					presentable: true
				},
				{ name: 'resolved', type: 'bool', required: false, hidden: false, presentable: false },
				{
					name: 'resolved_by',
					type: 'relation',
					required: false,
					options: { collectionId: users.id, cascadeDelete: false, maxSelect: 1 },
					hidden: false,
					presentable: false
				},
				{
					name: 'resolved_at',
					type: 'date',
					required: false,
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
				'CREATE INDEX idx_case_comments_case ON case_comments (case)',
				'CREATE INDEX idx_case_comments_resolved ON case_comments (resolved)',
				'CREATE INDEX idx_case_comments_created ON case_comments (created)'
			]
		});

		app.save(comments);
	},
	(app) => {
		try {
			app.delete(app.findCollectionByNameOrId('case_comments'));
		} catch (e) {
			// Collection was already removed.
		}
	}
);
