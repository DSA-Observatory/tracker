/// <reference path="../pb_data/types.d.ts" />
/* eslint-disable @typescript-eslint/no-require-imports -- PocketBase hook callbacks load helpers with require. */

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
	const validation = require(`${__hooks}/comment_assignment_helpers.js`).validateCommentMutation(
		e,
		false
	);
	if (validation) throwCommentValidationError(e, validation);
	e.record.set('author', e.auth.id);
	const assigneeId = e.record.getString('assignee');
	if (assigneeId) {
		let assignee;
		try {
			assignee = e.app.findRecordById('users', assigneeId);
		} catch {
			throw e.badRequestError('Assignee must be an administrator.', {
				assignee: new ValidationError('invalid_assignee', 'Choose an active administrator.')
			});
		}
		if (!assignee.getBool('is_admin')) {
			throw e.badRequestError('Assignee must be an administrator.', {
				assignee: new ValidationError('invalid_assignee', 'Choose an active administrator.')
			});
		}
	}
	e.next();
}, 'case_comments');

onRecordUpdateRequest((e) => {
	const validation = require(`${__hooks}/comment_assignment_helpers.js`).validateCommentMutation(
		e,
		true
	);
	if (validation) throwCommentValidationError(e, validation);
	if (e.record.getString('assignee') !== e.record.original().getString('assignee')) {
		const assigneeId = e.record.getString('assignee');
		if (assigneeId) {
			let assignee;
			try {
				assignee = e.app.findRecordById('users', assigneeId);
			} catch {
				throw e.badRequestError('Assignee must be an administrator.', {
					assignee: new ValidationError('invalid_assignee', 'Choose an active administrator.')
				});
			}
			if (!assignee.getBool('is_admin')) {
				throw e.badRequestError('Assignee must be an administrator.', {
					assignee: new ValidationError('invalid_assignee', 'Choose an active administrator.')
				});
			}
		}
	}
	e.next();
}, 'case_comments');

function throwCommentValidationError(e, validation) {
	throw e.badRequestError(validation.message, {
		[validation.field]: new ValidationError(validation.code, validation.message)
	});
}

routerAdd(
	'PATCH',
	'/api/admin/submissions/{id}/decision',
	(e) => {
		if (!e.auth || e.auth.collection().name !== 'users' || !e.auth.getBool('is_admin')) {
			throw e.forbiddenError('Admin access required.', null);
		}

		const decision = e.requestInfo().body.decision;
		if (decision !== 'accepted' && decision !== 'rejected' && decision !== 'pending') {
			throw e.badRequestError(
				'Decision must be accepted, rejected, or returned to suggested.',
				null
			);
		}

		let submission;
		let caseRecord = null;
		e.app.runInTransaction((txApp) => {
			submission = txApp.findRecordById('case_submissions', e.request.pathValue('id'));
			const currentStatus = submission.getString('status');
			const resultingCaseId = submission.getString('resulting_case');

			if (decision === 'pending') {
				if (currentStatus !== 'accepted' || !resultingCaseId) {
					throw e.badRequestError(
						'Only accepted suggestions with a draft can return to suggested.',
						null
					);
				}
				caseRecord = txApp.findRecordById('cases', resultingCaseId);
				if (caseRecord.getBool('published') || caseRecord.getString('status') !== 'draft') {
					throw e.badRequestError('Only unpublished draft cases can return to suggested.', null);
				}
				caseRecord.set('status', 'archived');
				txApp.save(caseRecord);
				submission.set('status', 'pending');
				submission.set('decided_by', '');
				submission.set('decided_at', '');
				txApp.save(submission);
				return;
			}

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
				} else {
					if (caseRecord.getBool('published')) {
						throw e.badRequestError(
							'Published cases cannot be returned to the suggestion workflow.',
							null
						);
					}
					caseRecord.set('status', 'draft');
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
