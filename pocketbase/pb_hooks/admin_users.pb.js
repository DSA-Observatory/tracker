/// <reference path="../pb_data/types.d.ts" />

const bootstrapAdminEmail = 'ctw@ctwhome.com';

function isAdmin(record) {
	return (
		!!record &&
		(record.getString('email').toLowerCase() === bootstrapAdminEmail || record.getBool('is_admin'))
	);
}

routerAdd(
	'PATCH',
	'/api/admin/users/{id}/verified',
	(e) => {
		if (!isAdmin(e.auth)) {
			throw e.forbiddenError('Admin access required.', null);
		}

		const body = {};
		e.bindBody(body);

		const user = e.app.findRecordById('users', e.request.pathValue('id'));
		user.set('verified', body.verified === true);
		e.app.save(user);

		e.json(200, user);
	},
	$apis.requireAuth()
);
