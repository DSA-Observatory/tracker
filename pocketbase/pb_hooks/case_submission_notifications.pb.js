/// <reference path="../pb_data/types.d.ts" />

function envList(name) {
	return ($os.getenv(name) || '')
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean);
}

function appUrl() {
	return ($os.getenv('PUBLIC_APP_URL') || $os.getenv('APP_URL') || 'http://localhost:46217').replace(
		/\/$/,
		''
	);
}

function escapeHtml(value) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

onRecordAfterCreateSuccess((e) => {
	e.next();

	const recipients = envList('CASE_SUBMISSION_NOTIFY_EMAILS');
	if (!recipients.length) return;

	const record = e.record;
	const title = record.getString('title') || 'Untitled case lead';
	const jurisdiction = record.getString('jurisdiction');
	const court = record.getString('court');
	const caseUrl = record.getString('case_url');
	const submitterName = record.getString('submitter_name');
	const submitterEmail = record.getString('submitter_email');
	const summary = record.getString('summary');
	const adminUrl = `${appUrl()}/admin/submissions`;

	const html = `
<p>A new DSA Case Law Tracker case lead was submitted.</p>
<p><strong>${escapeHtml(title)}</strong></p>
<ul>
	${jurisdiction ? `<li><strong>Jurisdiction:</strong> ${escapeHtml(jurisdiction)}</li>` : ''}
	${court ? `<li><strong>Court:</strong> ${escapeHtml(court)}</li>` : ''}
	${caseUrl ? `<li><strong>Source:</strong> <a href="${escapeHtml(caseUrl)}">${escapeHtml(caseUrl)}</a></li>` : ''}
	${submitterName || submitterEmail ? `<li><strong>Submitted by:</strong> ${escapeHtml([submitterName, submitterEmail].filter(Boolean).join(' '))}</li>` : ''}
</ul>
${summary ? `<div>${summary}</div>` : ''}
<p><a href="${adminUrl}">Review suggested cases</a></p>
`;

	const message = new MailerMessage({
		from: {
			address: e.app.settings().meta.senderAddress,
			name: e.app.settings().meta.senderName || 'DSA Case Law Tracker'
		},
		to: recipients.map((address) => ({ address })),
		subject: `New suggested case: ${title}`,
		html
	});

	e.app.newMailClient().send(message);
}, 'case_submissions');
