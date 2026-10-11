import { describe, expect, test } from 'bun:test';
import { groupOpenComments, isCommentAssignedTo } from '../src/lib/comments';

const comments = [
	{
		id: 'resolved',
		case: 'case-1',
		content: 'Already handled',
		author: 'user-1',
		resolved: true,
		created: '2026-08-01T09:00:00Z',
		updated: '2026-08-01T09:00:00Z',
		expand: { case: { id: 'case-1', case_id: 'DSA-1', title: 'First case' } }
	},
	{
		id: 'newer',
		case: 'case-1',
		content: 'Second open comment',
		author: 'user-1',
		resolved: false,
		created: '2026-08-03T09:00:00Z',
		updated: '2026-08-03T09:00:00Z',
		expand: { case: { id: 'case-1', case_id: 'DSA-1', title: 'First case' } }
	},
	{
		id: 'older',
		case: 'case-1',
		content: 'First open comment',
		author: 'user-2',
		resolved: false,
		created: '2026-08-02T09:00:00Z',
		updated: '2026-08-02T09:00:00Z',
		expand: { case: { id: 'case-1', case_id: 'DSA-1', title: 'First case' } }
	},
	{
		id: 'other',
		case: 'case-2',
		content: 'Other case',
		author: 'user-2',
		resolved: false,
		created: '2026-08-04T09:00:00Z',
		updated: '2026-08-04T09:00:00Z',
		expand: { case: { id: 'case-2', case_id: 'DSA-2', title: 'Second case' } }
	}
];

describe('groupOpenComments', () => {
	test('excludes resolved comments and groups the remainder by case', () => {
		const groups = groupOpenComments(comments);

		expect(groups).toHaveLength(2);
		expect(groups[0].target.title).toBe('Second case');
		expect(groups[0].comments).toHaveLength(1);
		expect(groups[1].comments.map((comment) => comment.id)).toEqual(['older', 'newer']);
	});

	test('keeps general comments separate and recognizes the stored self-assignment', () => {
		const general = {
			id: 'general-comment',
			content: 'Check the Irish database',
			author: 'user-1',
			assignee: 'admin-1',
			resolved: false,
			created: '2026-08-05T09:00:00Z',
			updated: '2026-08-05T09:00:00Z',
			expand: { assignee: { id: 'other-admin', email: 'other@example.com' } }
		};

		const groups = groupOpenComments([...comments, general]);
		const generalGroup = groups.find((group) => group.targetType === 'general');

		expect(generalGroup?.target.title).toBe('General comments');
		expect(isCommentAssignedTo(general, 'admin-1')).toBe(true);
	});
});
