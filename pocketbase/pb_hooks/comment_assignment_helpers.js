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
			assignedAdmin.getString('name') || assignedAdmin.getString('username') || assignedAdmin.email();
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

module.exports = { sendAssignmentNotification, sendCreatedCommentNotifications };
