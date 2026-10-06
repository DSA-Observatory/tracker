/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const comments = app.findCollectionByNameOrId('case_comments');
		const users = app.findCollectionByNameOrId('users');
		let assignee;
		try {
			assignee = comments.fields.getByName('assignee');
		} catch {
			assignee = null;
		}

		if (!assignee) {
			comments.fields.add(
				new Field({
					name: 'assignee',
					type: 'relation',
					required: false,
					collectionId: users.id,
					cascadeDelete: false,
					maxSelect: 1,
					hidden: false,
					presentable: false
				})
			);
		}
		if (!comments.indexes.includes('CREATE INDEX idx_case_comments_assignee ON case_comments (assignee)')) {
			comments.indexes.push('CREATE INDEX idx_case_comments_assignee ON case_comments (assignee)');
		}
		app.save(comments);
	},
	(app) => {
		const comments = app.findCollectionByNameOrId('case_comments');
		let assignee;
		try {
			assignee = comments.fields.getByName('assignee');
		} catch {
			assignee = null;
		}
		if (assignee) comments.fields.removeById(assignee.id);
		comments.indexes = comments.indexes.filter(
			(index) => !index.includes('idx_case_comments_assignee')
		);
		app.save(comments);
	}
);
