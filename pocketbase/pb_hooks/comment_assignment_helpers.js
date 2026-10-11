function escapeHtml(value) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function appUrl() {
	return (
		$os.getenv('PUBLIC_APP_URL') ||
		$os.getenv('APP_URL') ||
		'https://dsa-observatory.github.io/tracker'
	).replace(/\/$/, '');
}

function notificationRecipients() {
	return ($os.getenv('CASE_SUBMISSION_NOTIFY_EMAILS') || 'ctw@ctwhome.com')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);
}

function validateCommentMutation(e, isUpdate) {
	const caseId = e.record.getString('case');
	const submissionId = e.record.getString('submission');
	if ((caseId ? 1 : 0) + (submissionId ? 1 : 0) > 1) {
		return {
			field: 'case',
			code: 'invalid_target',
			message: 'A comment can belong to one case, one suggestion, or the general queue.'
		};
	}

	if (isUpdate) {
		const original = e.record.original();
		for (const field of ['case', 'submission', 'parent']) {
			if (e.record.getString(field) !== original.getString(field)) {
				return {
					field,
					code: 'immutable_comment_target',
					message: 'A comment target and reply parent cannot change after creation.'
				};
			}
		}
	}

	const parentId = e.record.getString('parent');
	if (!parentId) return null;
	if (parentId === e.record.id) {
		return {
			field: 'parent',
			code: 'invalid_parent',
			message: 'A comment cannot reply to itself.'
		};
	}

	try {
		const parent = e.app.findRecordById('case_comments', parentId);
		if (parent.getString('case') !== caseId || parent.getString('submission') !== submissionId) {
			return {
				field: 'parent',
				code: 'invalid_parent',
				message: 'Replies must stay with the same comment thread.'
			};
		}
	} catch {
		return {
			field: 'parent',
			code: 'invalid_parent',
			message: 'Reply parent does not exist.'
		};
	}

	return null;
}

function target(app, record) {
	const submissionId = record.getString('submission');
	const caseId = record.getString('case');
	let title = 'Editorial record';
	let targetUrl = `${appUrl()}/admin/comments`;
	try {
		if (submissionId) {
			const submission = app.findRecordById('case_submissions', submissionId);
			title = submission.getString('title') || 'Suggested case';
			targetUrl = `${appUrl()}/admin/submissions/${submissionId}?comment=${record.id}`;
		} else if (caseId) {
			const caseRecord = app.findRecordById('cases', caseId);
			title = caseRecord.getString('title') || 'Case';
			targetUrl = `${appUrl()}/cases/${caseId}/edit?comment=${record.id}`;
		}
	} catch (error) {
		console.error('Could not resolve comment notification target:', error);
	}
	return { title: title.replace(/[\r\n]+/g, ' '), targetUrl };
}

function assignee(app, record) {
	const assigneeId = record.getString('assignee');
	if (!assigneeId) return null;
	try {
		const user = app.findRecordById('users', assigneeId);
		return user.getBool('is_admin') && user.email() ? user : null;
	} catch (error) {
		console.error('Could not resolve comment assignee:', error);
		return null;
	}
}

function send(e, MailerMessage, recipients, subject, html, label) {
	if (!recipients.length) return;
	try {
		e.app.newMailClient().send(
			new MailerMessage({
				from: {
					address: e.app.settings().meta.senderAddress,
					name: e.app.settings().meta.senderName || 'DSA Case Law Tracker'
				},
				to: recipients.map((address) => ({ address })),
				subject,
				html
			})
		);
	} catch (error) {
		console.error(`Could not send ${label}:`, error);
	}
}

function sendAssignmentNotification(e, record, MailerMessage) {
	try {
		const assignedAdmin = assignee(e.app, record);
		if (!assignedAdmin) return;
		const { title, targetUrl } = target(e.app, record);
		const name =
			assignedAdmin.getString('name') ||
			assignedAdmin.getString('username') ||
			assignedAdmin.email();
		send(
			e,
			MailerMessage,
			[assignedAdmin.email()],
			`Comment assigned to you: ${title}`,
			`
<p>${escapeHtml(name)}, an editorial comment has been assigned to you for <strong>${escapeHtml(title)}</strong>.</p>
<blockquote>${escapeHtml(record.getString('content'))}</blockquote>
<p><a href="${escapeHtml(targetUrl)}">Review this comment</a></p>
`,
			'comment assignment notification'
		);
	} catch (error) {
		console.error('Could not prepare comment assignment notification:', error);
	}
}

function sendCreatedCommentNotifications(e, MailerMessage) {
	try {
		const record = e.record;
		const assignedAdmin = assignee(e.app, record);
		const { title, targetUrl } = target(e.app, record);
		const assigneeEmail = assignedAdmin ? assignedAdmin.email().toLowerCase() : '';
		const recipients = notificationRecipients().filter(
			(address) => address.toLowerCase() !== assigneeEmail
		);
		send(
			e,
			MailerMessage,
			recipients,
			`New editorial comment: ${title}`,
			`
<p>A new editorial comment was added to <strong>${escapeHtml(title)}</strong>.</p>
<blockquote>${escapeHtml(record.getString('content'))}</blockquote>
<p><a href="${escapeHtml(targetUrl)}">Review this comment</a></p>
`,
			'comment notification'
		);
		sendAssignmentNotification(e, record, MailerMessage);
	} catch (error) {
		console.error('Could not prepare comment notification:', error);
	}
}

module.exports = {
	sendAssignmentNotification,
	sendCreatedCommentNotifications,
	validateCommentMutation
};
