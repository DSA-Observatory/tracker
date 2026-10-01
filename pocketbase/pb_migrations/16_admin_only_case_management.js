/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const caseAdminRule = "@request.auth.id != '' && @request.auth.is_admin = true";
		const users = app.findCollectionByNameOrId('users');
		users.listRule = caseAdminRule;
		users.viewRule = `id = @request.auth.id || (${caseAdminRule})`;
		// Public registration cannot grant an admin role; only admins can change roles.
		users.createRule = `(${caseAdminRule}) || @request.body.is_admin:isset = false || @request.body.is_admin = false`;
		users.updateRule = `(${caseAdminRule}) || (id = @request.auth.id && @request.body.is_admin:changed = false)`;
		users.deleteRule = `id = @request.auth.id || (${caseAdminRule})`;
		app.save(users);

		const cases = app.findCollectionByNameOrId('cases');
		cases.listRule = `(published = true && status != 'archived') || (${caseAdminRule})`;
		cases.viewRule = cases.listRule;
		cases.createRule = caseAdminRule;
		cases.updateRule = caseAdminRule;
		cases.deleteRule = caseAdminRule;
		cases.fields.getByName('documents').protected = true;
		app.save(cases);
	},
	() => {
		// Do not reopen private records or self-promotion when rolling migrations back.
		// A deliberate permission change requires a separately reviewed migration.
	}
);
