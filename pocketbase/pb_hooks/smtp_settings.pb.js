/// <reference path="../pb_data/types.d.ts" />

onBootstrap((e) => {
	e.next();

	const getAppUrl = () =>
		(
			$os.getenv('PUBLIC_APP_URL') ||
			$os.getenv('APP_URL') ||
			'https://dsa-observatory.github.io/tracker'
		).replace(/\/$/, '');

	const syncPasswordResetTemplate = (app) => {
		const users = app.findCollectionByNameOrId('users');
		const passwordUrl = `${getAppUrl()}/password?token={TOKEN}`;

		users.resetPasswordTemplate.subject = 'Reset your DSA Case Law Tracker password';
		users.resetPasswordTemplate.body = `
<p>Hello,</p>
<p>A password reset was requested for your DSA Case Law Tracker account. Use the secure link below to choose a new password:</p>
<p><a href="${passwordUrl}">Reset your password</a></p>
<p>If the button does not work, copy and paste this link into your browser:<br>${passwordUrl}</p>
<p>If you did not request a password reset, you can ignore this email.</p>
`;

		app.save(users);
	};

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
