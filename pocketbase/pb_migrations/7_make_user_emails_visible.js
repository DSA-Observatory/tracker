/// <reference path="../pb_data/types.d.ts" />

function updateUserEmailVisibility(app, emailVisibility) {
	let offset = 0;
	const batchSize = 200;

	while (true) {
		const users = app.findRecordsByFilter('users', "id != ''", '', batchSize, offset);

		if (!users.length) break;

		for (const user of users) {
			user.set('emailVisibility', emailVisibility);
			app.save(user);
		}

		offset += users.length;
	}
}

migrate(
	(app) => {
		updateUserEmailVisibility(app, true);
	},
	() => {
		// Intentionally keep email visibility unchanged on rollback to avoid hiding existing accounts.
	}
);
