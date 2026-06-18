/// <reference path="../pb_data/types.d.ts" />

function getAppUrl() {
	return ($os.getenv('PUBLIC_APP_URL') || $os.getenv('APP_URL') || 'http://localhost:5173').replace(
		/\/$/,
		''
	);
}

function syncPasswordResetTemplate(app) {
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

onBootstrap((e) => {
	e.next();

	const settings = e.app.settings();
	const smtpEnabled = $os.getenv('SMTP_ENABLED') || 'false';

	settings.smtp.enabled = smtpEnabled === 'true';

	if (settings.smtp.enabled) {
		const smtpPort = parseInt($os.getenv('SMTP_PORT') || '587', 10);

		settings.smtp.host = $os.getenv('SMTP_HOST') || 'smtp.resend.com';
		settings.smtp.port = smtpPort;
		settings.smtp.username = $os.getenv('SMTP_USER') || 'resend';
		settings.smtp.password = $os.getenv('SMTP_PASS') || '';
		settings.smtp.tls = smtpPort === 465 || smtpPort === 587;

		const smtpFrom = $os.getenv('SMTP_FROM') || '';

		if (smtpFrom) {
			const emailMatch = smtpFrom.match(/<(.+)>/);
			const nameMatch = smtpFrom.match(/^([^<]+)</);

			if (emailMatch && emailMatch[1]) {
				settings.meta.senderAddress = emailMatch[1].trim();
			}

			if (nameMatch && nameMatch[1]) {
				settings.meta.senderName = nameMatch[1].trim();
			}

			if (!emailMatch && smtpFrom.includes('@')) {
				settings.meta.senderAddress = smtpFrom.trim();
			}
		}
	}

	settings.meta.appURL = getAppUrl();

	e.app.save(settings);
	syncPasswordResetTemplate(e.app);
	console.log(`SMTP settings synced: enabled=${settings.smtp.enabled}, host=${settings.smtp.host}`);
});
