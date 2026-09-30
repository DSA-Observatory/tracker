/// <reference path="../pb_data/types.d.ts" />

onRecordAfterCreateSuccess((e) => {
	e.next();

	const recipients = ($os.getenv('CASE_SUBMISSION_NOTIFY_EMAILS') || 'ctw@ctwhome.com')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);
	const appUrl = (
		$os.getenv('PUBLIC_APP_URL') ||
		$os.getenv('APP_URL') ||
		'https://dsa-observatory.github.io/tracker'
	).replace(/\/$/, '');
	const escapeHtml = (value) =>
		String(value || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	const send = (message, label) => {
		try {
			e.app.newMailClient().send(new MailerMessage(message));
		} catch (error) {
			console.error(`Could not send ${label}:`, error);
		}
	};

	const record = e.record;
	const title = (record.getString('title') || 'Untitled case lead').replace(/[\r\n]+/g, ' ');
	const jurisdiction = record.getString('jurisdiction');
	const court = record.getString('court');
	const caseUrl = record.getString('case_url');
	const submitterName = record.getString('submitter_name');
	const submitterEmail = record.getString('submitter_email');
	const summary = record.getString('summary');
	const from = {
		address: e.app.settings().meta.senderAddress,
		name: e.app.settings().meta.senderName || 'DSA Case Law Tracker'
	};

	if (recipients.length) {
		send(
			{
				from,
				to: recipients.map((address) => ({ address })),
				subject: `New suggested case: ${title}`,
				html: `
<p>A new DSA Case Law Tracker case lead was submitted.</p>
<p><strong>${escapeHtml(title)}</strong></p>
<ul>
	${jurisdiction ? `<li><strong>Jurisdiction:</strong> ${escapeHtml(jurisdiction)}</li>` : ''}
	${court ? `<li><strong>Court:</strong> ${escapeHtml(court)}</li>` : ''}
	${caseUrl ? `<li><strong>Source:</strong> <a href="${escapeHtml(caseUrl)}">${escapeHtml(caseUrl)}</a></li>` : ''}
	${submitterName || submitterEmail ? `<li><strong>Submitted by:</strong> ${escapeHtml([submitterName, submitterEmail].filter(Boolean).join(' '))}</li>` : ''}
</ul>
${summary ? `<div>${escapeHtml(summary)}</div>` : ''}
<p><a href="${appUrl}/admin/submissions/${record.id}">Review this suggested case</a></p>
`
			},
			'new-case notification'
		);
	}

	if (submitterEmail) {
		send(
			{
				from,
				to: [{ address: submitterEmail }],
				subject: `We received your suggested case: ${title}`,
				html: `
<p>Hello${submitterName ? ` ${escapeHtml(submitterName)}` : ''},</p>
<p>Thank you for suggesting <strong>${escapeHtml(title)}</strong>.</p>
<p>We received your case lead and added it to the editorial review queue. It will not be published automatically.</p>
<p>The DSA Case Law Tracker editorial team may contact you if more information is needed.</p>
`
			},
			'submitter confirmation'
		);
	}
}, 'case_submissions');

onRecordAfterCreateSuccess((e) => {
	e.next();

	const recipients = ($os.getenv('CASE_SUBMISSION_NOTIFY_EMAILS') || 'ctw@ctwhome.com')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);
	if (!recipients.length) return;
	const appUrl = (
		$os.getenv('PUBLIC_APP_URL') ||
		$os.getenv('APP_URL') ||
		'https://dsa-observatory.github.io/tracker'
	).replace(/\/$/, '');
	const escapeHtml = (value) =>
		String(value || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');

	const record = e.record;
	const submissionId = record.getString('submission');
	const caseId = record.getString('case');
	let title = 'Editorial record';
	let targetUrl = `${appUrl}/admin/comments`;
	try {
		if (submissionId) {
			const submission = e.app.findRecordById('case_submissions', submissionId);
			title = submission.getString('title') || 'Suggested case';
			targetUrl = `${appUrl}/admin/submissions/${submissionId}`;
		} else if (caseId) {
			const caseRecord = e.app.findRecordById('cases', caseId);
			title = caseRecord.getString('title') || 'Case';
			targetUrl = `${appUrl}/cases/${caseId}/edit?comment=${record.id}`;
		}
	} catch (error) {
		console.error('Could not resolve comment notification target:', error);
	}
	title = title.replace(/[\r\n]+/g, ' ');

	try {
		e.app.newMailClient().send(
			new MailerMessage({
				from: {
					address: e.app.settings().meta.senderAddress,
					name: e.app.settings().meta.senderName || 'DSA Case Law Tracker'
				},
				to: recipients.map((address) => ({ address })),
				subject: `New editorial comment: ${title}`,
				html: `
<p>A new editorial comment was added to <strong>${escapeHtml(title)}</strong>.</p>
<blockquote>${escapeHtml(record.getString('content'))}</blockquote>
<p><a href="${targetUrl}">Review this comment</a></p>
`
			})
		);
	} catch (error) {
		console.error('Could not send comment notification:', error);
	}
}, 'case_comments');
