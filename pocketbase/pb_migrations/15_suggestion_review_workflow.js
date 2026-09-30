/// <reference path="../pb_data/types.d.ts" />

const adminRule = '@request.auth.is_admin = true || @request.auth.email = "ctw@ctwhome.com"';

function findField(fields, name) {
	try {
		return fields.getByName(name);
	} catch (e) {
		return null;
	}
}

function addField(collection, definition) {
	if (!findField(collection.fields, definition.name)) {
		collection.fields.add(new Field({ ...definition, hidden: false, presentable: false }));
	}
}

const submissionFields = [
	{ name: 'decision_date', type: 'date', required: false, min: '', max: '' },
	{ name: 'plaintiffs', type: 'json', required: false, maxSize: 2000000 },
	{ name: 'defendants', type: 'json', required: false, maxSize: 2000000 },
	{ name: 'dsa_articles', type: 'json', required: false, maxSize: 2000000 },
	{ name: 'document_links', type: 'json', required: false, maxSize: 2000000 }
];

migrate(
	(app) => {
		const submissions = app.findCollectionByNameOrId('case_submissions');
		const cases = app.findCollectionByNameOrId('cases');
		const users = app.findCollectionByNameOrId('users');

		for (const field of submissionFields) addField(submissions, field);
		addField(cases, {
			name: 'submitted_by',
			type: 'text',
			required: false,
			max: 240,
			min: 0,
			pattern: ''
		});
		app.save(cases);
		addField(submissions, {
			name: 'resulting_case',
			type: 'relation',
			required: false,
			collectionId: cases.id,
			cascadeDelete: false,
			maxSelect: 1
		});
		addField(submissions, {
			name: 'decided_by',
			type: 'relation',
			required: false,
			collectionId: users.id,
			cascadeDelete: false,
			maxSelect: 1
		});
		addField(submissions, { name: 'decided_at', type: 'date', required: false, min: '', max: '' });

		const status = findField(submissions.fields, 'status');
		if (status && !status.values.includes('pending')) status.values.push('pending');
		submissions.listRule = adminRule;
		submissions.viewRule = adminRule;
		submissions.createRule = '';
		submissions.updateRule = null;
		submissions.deleteRule = null;
		app.save(submissions);

		for (const record of app.findRecordsByFilter('case_submissions', 'status = "new"', '', 0, 0)) {
			record.set('status', 'pending');
			app.save(record);
		}

		const comments = app.findCollectionByNameOrId('case_comments');
		const caseField = findField(comments.fields, 'case');
		if (caseField) caseField.required = false;
		addField(comments, {
			name: 'submission',
			type: 'relation',
			required: false,
			collectionId: submissions.id,
			cascadeDelete: true,
			maxSelect: 1
		});
		if (
			!comments.indexes.includes(
				'CREATE INDEX idx_case_comments_submission ON case_comments (submission)'
			)
		) {
			comments.indexes.push(
				'CREATE INDEX idx_case_comments_submission ON case_comments (submission)'
			);
		}
		app.save(comments);
	},
	(app) => {
		const submissions = app.findCollectionByNameOrId('case_submissions');
		for (const record of app.findRecordsByFilter(
			'case_submissions',
			'status = "pending"',
			'',
			0,
			0
		)) {
			record.set('status', 'new');
			app.save(record);
		}
		const status = findField(submissions.fields, 'status');
		if (status) status.values = status.values.filter((value) => value !== 'pending');
		for (const name of ['resulting_case', 'decided_by', 'decided_at']) {
			const field = findField(submissions.fields, name);
			if (field) submissions.fields.removeById(field.id);
		}
		submissions.listRule = "@request.auth.id != ''";
		submissions.viewRule = "@request.auth.id != ''";
		submissions.updateRule = "@request.auth.id != ''";
		submissions.deleteRule = "@request.auth.id != ''";
		app.save(submissions);

		const comments = app.findCollectionByNameOrId('case_comments');
		for (const record of app.findRecordsByFilter('case_comments', 'submission != ""', '', 0, 0)) {
			app.delete(record);
		}
		const caseField = findField(comments.fields, 'case');
		if (caseField) caseField.required = true;
		const submissionField = findField(comments.fields, 'submission');
		if (submissionField) comments.fields.removeById(submissionField.id);
		comments.indexes = comments.indexes.filter(
			(index) => !index.includes('idx_case_comments_submission')
		);
		app.save(comments);
	}
);
