/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const adminRule = "@request.auth.id != '' && @request.auth.is_admin = true";
		const submissions = app.findCollectionByNameOrId('case_submissions');
		submissions.listRule = adminRule;
		submissions.viewRule = adminRule;
		// Anyone can suggest; only the decision hook may change review state.
		submissions.createRule = '';
		submissions.updateRule = null;
		submissions.deleteRule = null;
		app.save(submissions);

		const comments = app.findCollectionByNameOrId('case_comments');
		for (const rule of ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule']) {
			comments[rule] = adminRule;
		}
		app.save(comments);
	},
	() => {
		// Never reopen editorial data to email-only identities during rollback.
	}
);
