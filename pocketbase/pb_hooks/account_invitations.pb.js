/// <reference path="../pb_data/types.d.ts" />

onRecordAfterUpdateSuccess((e) => {
	e.next();

	try {
		e.app.findCollectionByNameOrId('account_invitations');
	} catch (_) {
		// A missing invitation collection must not interfere with a user update.
		return;
	}

	const invitations = e.app.findRecordsByFilter(
		'account_invitations',
		'user = {:user} && state = "pending"',
		'',
		1,
		0,
		{ user: e.record.id }
	);
	const invitation = invitations[0];
	if (!invitation) return;

	const stillBound =
		invitation.getString('email') === e.record.email() &&
		$security.equal(invitation.getString('token_key_hash'), $security.sha256(e.record.tokenKey()));

	if (!stillBound) {
		invitation.set('state', 'revoked');
		e.app.save(invitation);
	}
}, 'users');

routerAdd(
	'POST',
	'/api/admin/invitations',
	(e) => {
		if (!e.auth || e.auth.collection().name !== 'users' || !e.auth.getBool('is_admin')) {
			throw e.forbiddenError('Admin access required.', null);
		}

		const body = e.requestInfo().body || {};
		const name = typeof body.name === 'string' ? body.name.trim() : '';
		const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
		const errors = {};

		if (!name || name.length > 255) {
			errors.name = new ValidationError('invalid_name', 'Enter a name up to 255 characters.');
		}
		if (
			!email ||
			email.length > 254 ||
			!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
		) {
			errors.email = new ValidationError('invalid_email', 'Enter a valid email address.');
		}
		if (Object.keys(errors).length) {
			throw e.badRequestError('Invalid invitation details.', errors);
		}

		const secret = $security.randomString(64);
		let user = null;

		e.app.runInTransaction((txApp) => {
			try {
				txApp.findAuthRecordByEmail('users', email);
				throw e.badRequestError('An account already exists for this email. Send a recovery link instead.', {
					email: new ValidationError(
						'account_exists',
						'An account already exists for this email. Send a recovery link instead.'
					)
				});
			} catch (error) {
				if (error && error.status === 400) throw error;
			}

			const users = txApp.findCollectionByNameOrId('users');
			user = new Record(users);
			user.set('name', name);
			user.setEmail(email);
			user.set('emailVisibility', true);
			user.set('is_admin', false);
			user.setVerified(false);
			user.setRandomPassword();
			txApp.save(user);

			const invitations = txApp.findCollectionByNameOrId('account_invitations');
			const invitation = new Record(invitations);
			invitation.set('user', user.id);
			invitation.set('email', email);
			invitation.set('token_hash', $security.sha256(secret));
			invitation.set('token_key_hash', $security.sha256(user.tokenKey()));
			invitation.set('state', 'pending');
			invitation.set('purpose', 'setup');
			txApp.save(invitation);
		});

		let mailSent = true;
		try {
			const appUrl = (
				$os.getenv('PUBLIC_APP_URL') ||
				$os.getenv('APP_URL') ||
				'https://dsa-observatory.github.io/tracker'
			).replace(/\/$/, '');
			const setupUrl = `${appUrl}/password#invite=${secret}`;
			const escapedName = name
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#39;');

			e.app.newMailClient().send(
				new MailerMessage({
					from: {
						address: e.app.settings().meta.senderAddress,
						name: e.app.settings().meta.senderName || 'DSA Case Law Tracker'
					},
					to: [{ address: email }],
					subject: 'Set up your DSA Case Law Tracker account',
					html: `<p>Hello${escapedName ? ` ${escapedName}` : ''},</p>
<p>An account has been created for you on DSA Case Law Tracker. Use the secure link below to choose your password.</p>
<p><a href="${setupUrl}">Set up your account</a></p>
<p>If the button does not work, copy and paste this link into your browser:<br>${setupUrl}</p>`
				})
			);
		} catch (_) {
			mailSent = false;
		}

		const response = { user: user.publicExport(), status: 'pending', mailSent };
		if (!mailSent) {
			response.mailError = 'delivery_failed';
		}
		e.json(200, response);
	},
	$apis.requireAuth(),
	$apis.bodyLimit(4096)
);

routerAdd(
	'POST',
	'/api/admin/users/{id}/recovery-invitation',
	(e) => {
		if (!e.auth || e.auth.collection().name !== 'users' || !e.auth.getBool('is_admin')) {
			throw e.forbiddenError('Admin access required.', null);
		}

		const secret = $security.randomString(64);
		let user = null;
		let invitation = null;

		e.app.runInTransaction((txApp) => {
			try {
				user = txApp.findRecordById('users', e.request.pathValue('id'));
			} catch (_) {
				throw e.notFoundError('User not found.', null);
			}

			try {
				invitation = txApp.findFirstRecordByFilter(
					'account_invitations',
					'user = {:user}',
					{ user: user.id }
				);
			} catch (_) {
				invitation = new Record(txApp.findCollectionByNameOrId('account_invitations'));
				invitation.set('user', user.id);
			}

			invitation.set('email', user.email());
			invitation.set('token_hash', $security.sha256(secret));
			invitation.set('token_key_hash', $security.sha256(user.tokenKey()));
			invitation.set('state', 'pending');
			invitation.set('purpose', 'recovery');
			txApp.save(invitation);
		});

		let mailSent = true;
		try {
			const appUrl = (
				$os.getenv('PUBLIC_APP_URL') ||
				$os.getenv('APP_URL') ||
				'https://dsa-observatory.github.io/tracker'
			).replace(/\/$/, '');
			const recoveryUrl = `${appUrl}/password#invite=${secret}`;
			const name = user.getString('name');
			const escapedName = name
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#39;');

			e.app.newMailClient().send(
				new MailerMessage({
					from: {
						address: e.app.settings().meta.senderAddress,
						name: e.app.settings().meta.senderName || 'DSA Case Law Tracker'
					},
					to: [{ address: user.email() }],
					subject: 'DSA Case Law Tracker account recovery',
					html: `<p>Hello${escapedName ? ` ${escapedName}` : ''},</p>
<p>An administrator authorized account recovery for your DSA Case Law Tracker account. Use the secure link below to choose a new password.</p>
<p><a href="${recoveryUrl}">Recover your account</a></p>
<p>This recovery link does not expire, but it stops working after use, revocation, or an email/password change.</p>
<p>If the button does not work, copy and paste this link into your browser:<br>${recoveryUrl}</p>`
				})
			);
		} catch (_) {
			mailSent = false;
		}

		const response = { id: invitation.id, status: 'pending', purpose: 'recovery', mailSent };
		if (!mailSent) response.mailError = 'delivery_failed';
		e.json(200, response);
	},
	$apis.requireAuth(),
	$apis.bodyLimit(1024)
);

routerAdd(
	'GET',
	'/api/admin/invitations',
	(e) => {
		if (!e.auth || e.auth.collection().name !== 'users' || !e.auth.getBool('is_admin')) {
			throw e.forbiddenError('Admin access required.', null);
		}

		const invitations = e.app.findRecordsByFilter('account_invitations', '', '-created', 500, 0);
		const items = [];

		for (const invitation of invitations) {
			let user = null;
			let status = invitation.getString('state');
			try {
				user = e.app.findRecordById('users', invitation.getString('user'));
			} catch (_) {}

			const stillBound =
				user &&
				invitation.getString('email') === user.email() &&
				$security.equal(invitation.getString('token_key_hash'), $security.sha256(user.tokenKey()));
			if (status === 'pending' && !stillBound) {
				invitation.set('state', 'revoked');
				e.app.save(invitation);
				status = 'revoked';
			}

			items.push({
				id: invitation.id,
				user: user
					? {
							id: user.id,
							name: user.getString('name'),
							verified: user.verified(),
							is_admin: user.getBool('is_admin'),
							created: user.getString('created'),
							updated: user.getString('updated')
						}
					: null,
				status,
				purpose: invitation.getString('purpose')
			});
		}

		e.json(200, { items });
	},
	$apis.requireAuth()
);

routerAdd(
	'POST',
	'/api/admin/invitations/{id}/resend',
	(e) => {
		if (!e.auth || e.auth.collection().name !== 'users' || !e.auth.getBool('is_admin')) {
			throw e.forbiddenError('Admin access required.', null);
		}

		const secret = $security.randomString(64);
		let invitation = null;
		let user = null;
		let cannotResend = false;

		e.app.runInTransaction((txApp) => {
			try {
				invitation = txApp.findRecordById('account_invitations', e.request.pathValue('id'));
			} catch (_) {
				throw e.notFoundError('Invitation not found.', null);
			}
			if (invitation.getString('state') !== 'pending') {
				cannotResend = true;
				return;
			}

			try {
				user = txApp.findRecordById('users', invitation.getString('user'));
			} catch (_) {
				invitation.set('state', 'revoked');
				txApp.save(invitation);
				cannotResend = true;
				return;
			}

			const stillBound =
				invitation.getString('email') === user.email() &&
				$security.equal(invitation.getString('token_key_hash'), $security.sha256(user.tokenKey()));
			if (!stillBound) {
				invitation.set('state', 'revoked');
				txApp.save(invitation);
				cannotResend = true;
				return;
			}

			invitation.set('token_hash', $security.sha256(secret));
			txApp.save(invitation);
		});

		if (cannotResend) {
			throw e.badRequestError('Invitation can no longer be resent.', {
				invitation: new ValidationError('not_pending', 'Invitation can no longer be resent.')
			});
		}

		let mailSent = true;
		try {
			const appUrl = (
				$os.getenv('PUBLIC_APP_URL') ||
				$os.getenv('APP_URL') ||
				'https://dsa-observatory.github.io/tracker'
			).replace(/\/$/, '');
			const setupUrl = `${appUrl}/password#invite=${secret}`;
			const purpose = invitation.getString('purpose');
			const name = user.getString('name');
			const escapedName = name
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#39;');

			e.app.newMailClient().send(
				new MailerMessage({
					from: {
						address: e.app.settings().meta.senderAddress,
						name: e.app.settings().meta.senderName || 'DSA Case Law Tracker'
					},
					to: [{ address: invitation.getString('email') }],
					subject:
						purpose === 'recovery'
							? 'DSA Case Law Tracker account recovery'
							: 'Set up your DSA Case Law Tracker account',
					html: `<p>Hello${escapedName ? ` ${escapedName}` : ''},</p>
<p>${purpose === 'recovery' ? 'An administrator authorized account recovery. Use the secure link below to choose a new password.' : 'Use the secure link below to choose your password for DSA Case Law Tracker.'}</p>
<p><a href="${setupUrl}">${purpose === 'recovery' ? 'Recover your account' : 'Set up your account'}</a></p>
${purpose === 'recovery' ? '<p>This recovery link does not expire, but it stops working after use, revocation, or an email/password change.</p>' : ''}
<p>If the button does not work, copy and paste this link into your browser:<br>${setupUrl}</p>`
				})
			);
		} catch (_) {
			mailSent = false;
		}

		const response = { id: invitation.id, status: 'pending', mailSent };
		if (!mailSent) {
			response.mailError = 'delivery_failed';
		}
		e.json(200, response);
	},
	$apis.requireAuth(),
	$apis.bodyLimit(1024)
);

routerAdd(
	'POST',
	'/api/admin/invitations/{id}/revoke',
	(e) => {
		if (!e.auth || e.auth.collection().name !== 'users' || !e.auth.getBool('is_admin')) {
			throw e.forbiddenError('Admin access required.', null);
		}

		let invitation = null;
		try {
			invitation = e.app.findRecordById('account_invitations', e.request.pathValue('id'));
		} catch (_) {
			throw e.notFoundError('Invitation not found.', null);
		}
		if (invitation.getString('state') === 'pending') {
			invitation.set('state', 'revoked');
			e.app.save(invitation);
		}

		e.json(200, { id: invitation.id, status: invitation.getString('state') });
	},
	$apis.requireAuth(),
	$apis.bodyLimit(1024)
);

routerAdd(
	'POST',
	'/api/account/setup',
	(e) => {
		const store = e.app.store();
		const throttleKey = `account-setup:${$security.sha256(e.realIP())}`;
		const now = Date.now();
		let allowed = true;
		store.setFunc(throttleKey, (previous) => {
			const current = previous && typeof previous === 'object' ? previous : null;
			if (!current || now - current.startedAt >= 60 * 1000) {
				return { startedAt: now, attempts: 1 };
			}
			if (current.attempts >= 10) {
				allowed = false;
				return current;
			}
			return { startedAt: current.startedAt, attempts: current.attempts + 1 };
		});
		if (!allowed) {
			throw e.tooManyRequestsError('Too many setup attempts. Try again later.', {
				token: new ValidationError('rate_limited', 'Too many setup attempts. Try again later.')
			});
		}

		const body = e.requestInfo().body || {};
		const secret = body.invitation;
		const password = body.password;
		const passwordConfirm = body.passwordConfirm;
		const errors = {};

		if (typeof secret !== 'string' || secret.length < 48 || secret.length > 128 || !/^[A-Za-z0-9]+$/.test(secret)) {
			errors.token = new ValidationError('invalid_token', 'Invitation is invalid or can no longer be used.');
		}
		if (typeof password !== 'string' || password.length > 255) {
			errors.password = new ValidationError('invalid_password', 'Enter a password up to 255 characters.');
		}
		if (typeof passwordConfirm !== 'string' || passwordConfirm.length > 255 || passwordConfirm !== password) {
			errors.passwordConfirm = new ValidationError('password_mismatch', 'Passwords do not match.');
		}
		if (Object.keys(errors).length) {
			throw e.badRequestError('Unable to set up this account.', errors);
		}

		let minimumPasswordLength = 8;
		try {
			minimumPasswordLength = e.app.findCollectionByNameOrId('users').options.minPasswordLength || 8;
		} catch (_) {
			// The later save will return the collection's password policy error.
		}
		if (password.length < minimumPasswordLength) {
			throw e.badRequestError('Unable to set up this account.', {
				password: new ValidationError(
					'invalid_password',
					`Enter a password with at least ${minimumPasswordLength} characters.`
				)
			});
		}

		const tokenHash = $security.sha256(secret);
		let validInvitation = true;

		e.app.runInTransaction((txApp) => {
			let invitation = null;
			let user = null;
			try {
				invitation = txApp.findFirstRecordByFilter(
					'account_invitations',
					'state = "pending" && token_hash = {:tokenHash}',
					{ tokenHash }
				);
				user = txApp.findRecordById('users', invitation.getString('user'));
			} catch (_) {
				validInvitation = false;
				return;
			}

			const stillBound =
				invitation.getString('email') === user.email() &&
				$security.equal(invitation.getString('token_hash'), tokenHash) &&
				$security.equal(invitation.getString('token_key_hash'), $security.sha256(user.tokenKey()));
			if (!stillBound) {
				if (invitation.getString('state') === 'pending') {
					invitation.set('state', 'revoked');
					txApp.save(invitation);
				}
				validInvitation = false;
				return;
			}

			user.setPassword(password);
			user.setVerified(true);
			txApp.save(user);
			invitation.set('state', 'used');
			txApp.save(invitation);
		});

		if (!validInvitation) {
			throw e.badRequestError('Unable to set up this account.', {
				token: new ValidationError('invalid_token', 'Invitation is invalid or can no longer be used.')
			});
		}

		e.noContent(204);
	},
	$apis.bodyLimit(4096)
);
