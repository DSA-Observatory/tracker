/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const comments = app.findCollectionByNameOrId('case_comments');
		let parent;
		try {
			parent = comments.fields.getByName('parent');
		} catch {
			parent = null;
		}

		if (!parent) {
			comments.fields.add(
				new Field({
					name: 'parent',
					type: 'relation',
					required: false,
					collectionId: comments.id,
					cascadeDelete: false,
					maxSelect: 1,
					hidden: false,
					presentable: false
				})
			);
		}
		if (
			!comments.indexes.includes('CREATE INDEX idx_case_comments_parent ON case_comments (parent)')
		) {
			comments.indexes.push('CREATE INDEX idx_case_comments_parent ON case_comments (parent)');
		}
		app.save(comments);
	},
	(app) => {
		const comments = app.findCollectionByNameOrId('case_comments');
		let parent;
		try {
			parent = comments.fields.getByName('parent');
		} catch {
			parent = null;
		}
		if (parent) comments.fields.removeById(parent.id);
		comments.indexes = comments.indexes.filter(
			(index) => !index.includes('idx_case_comments_parent')
		);
		app.save(comments);
	}
);
