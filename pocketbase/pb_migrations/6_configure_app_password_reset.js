/// <reference path="../pb_data/types.d.ts" />

function getAppUrl() {
	return (
		$os.getenv('PUBLIC_APP_URL') ||
		$os.getenv('APP_URL') ||
		'https://casetracker.ctwhome.com'
	).replace(/\/$/, '');
}

function applyPasswordResetTemplate(app) {
	const users = app.findCollectionByNameOrId('users');
	const passwordUrl = `${getAppUrl()}/password?token={TOKEN}`;

	users.options.resetPasswordTemplate = users.options.resetPasswordTemplate || {};
	users.options.resetPasswordTemplate.subject = 'Set your DSA Case Law Tracker password';
	users.options.resetPasswordTemplate.body = `
<p>Hello,</p>
<p>You have been invited to DSA Case Law Tracker. Use the secure link below to set your password:</p>
<p><a href="${passwordUrl}">Set your password</a></p>
<p>If the button does not work, copy and paste this link into your browser:<br>${passwordUrl}</p>
<p>If you did not expect this invitation, you can ignore this email.</p>
`;

	app.save(users);
}

migrate(
	(app) => {
		const settings = app.settings();
		settings.meta.appURL = getAppUrl();
		app.save(settings);

		applyPasswordResetTemplate(app);
	},
	(app) => {
		const users = app.findCollectionByNameOrId('users');

		users.options.resetPasswordTemplate = users.options.resetPasswordTemplate || {};
		users.options.resetPasswordTemplate.subject = '';
		users.options.resetPasswordTemplate.body = '';

		app.save(users);
	}
);
