/// <reference path="../pb_data/types.d.ts" />

routerAdd(
	'PATCH',
	'/api/admin/users/{id}/verified',
	(e) => {
		if (!e.auth || e.auth.collection().name !== 'users' || !e.auth.getBool('is_admin')) {
			throw e.forbiddenError('Admin access required.', null);
		}

		const body = e.requestInfo().body;
		if (typeof body.verified !== 'boolean') {
			throw e.badRequestError('verified must be a boolean.', null);
		}

		const user = e.app.findRecordById('users', e.request.pathValue('id'));
		user.set('verified', body.verified === true);
		e.app.save(user);

		e.json(200, user);
	},
	$apis.requireAuth()
);
