/// <reference path="../pb_data/types.d.ts" />

const bootstrapAdminEmail = 'ctw@ctwhome.com';
const adminRule = `@request.auth.email = "${bootstrapAdminEmail}" || @request.auth.is_admin = true`;

function findField(fields, name) {
	try {
		return fields.getByName(name);
	} catch (e) {
		return null;
	}
}

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');

		if (!findField(users.fields, 'is_admin')) {
			users.fields.add(
				new Field({
					name: 'is_admin',
					type: 'bool',
					required: false,
					hidden: false,
					presentable: false
				})
			);
		}

		users.listRule = adminRule;
		users.viewRule = `id = @request.auth.id || ${adminRule}`;
		users.updateRule = `id = @request.auth.id || ${adminRule}`;
		users.deleteRule = `id = @request.auth.id || ${adminRule}`;

		app.save(users);

		const bootstrapAdmin = app.findFirstRecordByFilter('users', 'email = {:email}', {
			email: bootstrapAdminEmail
		});

		if (bootstrapAdmin) {
			bootstrapAdmin.set('is_admin', true);
			bootstrapAdmin.set('emailVisibility', true);
			app.save(bootstrapAdmin);
		}
	},
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		const isAdminField = findField(users.fields, 'is_admin');

		if (isAdminField) users.fields.removeById(isAdminField.id);

		users.listRule = `@request.auth.email = "${bootstrapAdminEmail}"`;
		users.viewRule = `id = @request.auth.id || @request.auth.email = "${bootstrapAdminEmail}"`;
		users.updateRule = `id = @request.auth.id || @request.auth.email = "${bootstrapAdminEmail}"`;
		users.deleteRule = `id = @request.auth.id || @request.auth.email = "${bootstrapAdminEmail}"`;

		app.save(users);
	}
);
