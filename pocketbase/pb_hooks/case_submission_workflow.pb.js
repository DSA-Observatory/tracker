/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
	const links = e.record.getStringSlice('document_links');
	const caseUrl = e.record.getString('case_url');
	for (const value of [...links, caseUrl].filter(Boolean)) {
		if (!/^https?:\/\//i.test(value)) {
			throw e.badRequestError('Source links must use HTTP or HTTPS.', null);
		}
	}
	e.record.set('status', 'pending');
	e.record.set('editorial_notes', '');
	e.record.set('resulting_case', '');
	e.record.set('decided_by', '');
	e.record.set('decided_at', '');
	e.next();
}, 'case_submissions');

onRecordCreateRequest((e) => {
	const caseId = e.record.getString('case');
	const submissionId = e.record.getString('submission');
	if ((caseId ? 1 : 0) + (submissionId ? 1 : 0) !== 1) {
		throw e.badRequestError('A comment must belong to exactly one case or suggestion.', null);
	}
	e.record.set('author', e.auth.id);
	e.next();
}, 'case_comments');

onRecordUpdateRequest((e) => {
	const caseId = e.record.getString('case');
	const submissionId = e.record.getString('submission');
	if ((caseId ? 1 : 0) + (submissionId ? 1 : 0) !== 1) {
		throw e.badRequestError('A comment must belong to exactly one case or suggestion.', null);
	}
	e.next();
}, 'case_comments');

routerAdd(
	'PATCH',
	'/api/admin/submissions/{id}/decision',
	(e) => {
		if (!e.auth || e.auth.collection().name !== 'users' || !e.auth.getBool('is_admin')) {
			throw e.forbiddenError('Admin access required.', null);
		}

		const decision = e.requestInfo().body.decision;
		if (decision !== 'accepted' && decision !== 'rejected') {
			throw e.badRequestError('Decision must be accepted or rejected.', null);
		}

		let submission;
		let caseRecord = null;
		e.app.runInTransaction((txApp) => {
			submission = txApp.findRecordById('case_submissions', e.request.pathValue('id'));
			const currentStatus = submission.getString('status');
			const resultingCaseId = submission.getString('resulting_case');

			if (currentStatus === 'accepted' && resultingCaseId) {
				if (decision !== 'accepted') {
					throw e.badRequestError('Accepted suggestions cannot be rejected.', null);
				}
				caseRecord = txApp.findRecordById('cases', resultingCaseId);
				return;
			}
			if (currentStatus === 'rejected' && decision === 'rejected') return;
			if (
				currentStatus === 'rejected' ||
				(currentStatus === 'accepted' && decision === 'rejected')
			) {
				throw e.badRequestError('This suggestion already has a final decision.', null);
			}
			if (!['new', 'pending', 'review', 'accepted'].includes(currentStatus)) {
				throw e.badRequestError('This suggestion cannot be decided from its current state.', null);
			}

			if (decision === 'accepted') {
				caseRecord = txApp.findRecordsByFilter('cases', 'submitted_by = {:submission}', '', 1, 0, {
					submission: submission.id
				})[0];
				if (!caseRecord) {
					const cases = txApp.findCollectionByNameOrId('cases');
					caseRecord = new Record(cases);
					caseRecord.set('case_id', `suggestion-${submission.id}`);
					caseRecord.set('title', submission.getString('title'));
					caseRecord.set('decision_date', submission.getString('decision_date'));
					caseRecord.set('jurisdiction', submission.getString('jurisdiction'));
					caseRecord.set('court', submission.getString('court'));
					caseRecord.set('plaintiffs', submission.get('plaintiffs'));
					caseRecord.set('defendants', submission.get('defendants'));
					caseRecord.set('dsa_articles', submission.get('dsa_articles'));
					const sourceLinks = submission.getStringSlice('document_links');
					const caseUrl = submission.getString('case_url');
					if (caseUrl && !sourceLinks.includes(caseUrl)) sourceLinks.push(caseUrl);
					caseRecord.set('document_links', sourceLinks);
					caseRecord.set(
						'summary',
						submission
							.getString('summary')
							.replace(/&/g, '&amp;')
							.replace(/</g, '&lt;')
							.replace(/>/g, '&gt;')
							.replace(/"/g, '&quot;')
							.replace(/'/g, '&#39;')
					);
					caseRecord.set('submitted_by', submission.id);
					caseRecord.set('status', 'draft');
					caseRecord.set('published', false);
					txApp.save(caseRecord);
				}
				submission.set('resulting_case', caseRecord.id);
			}

			submission.set('status', decision);
			submission.set('decided_by', e.auth.id);
			submission.set('decided_at', new Date().toISOString());
			txApp.save(submission);
		});

		e.json(200, { submission, case: caseRecord });
	},
	$apis.requireAuth()
);
