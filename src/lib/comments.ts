export interface CommentCaseRecord {
	id: string;
	case_id: string;
	title: string;
}

export interface CommentSubmissionRecord {
	id: string;
	title: string;
	case_id?: string;
}

export interface CommentAdminRecord {
	id: string;
	email: string;
	name?: string;
	username?: string;
}

export interface CaseCommentRecord {
	id: string;
	case?: string;
	submission?: string;
	content: string;
	author: string;
	assignee?: string;
	resolved: boolean;
	resolved_by?: string;
	resolved_at?: string;
	created: string;
	updated: string;
	expand?: {
		case?: CommentCaseRecord;
		submission?: CommentSubmissionRecord;
		author?: { id: string; email: string; name?: string; username?: string };
		assignee?: CommentAdminRecord;
		resolved_by?: { id: string; email: string; name?: string; username?: string };
	};
}

export interface CaseCommentGroup {
	target: CommentCaseRecord | CommentSubmissionRecord;
	targetType: 'case' | 'submission';
	comments: CaseCommentRecord[];
}

export function groupOpenComments(comments: CaseCommentRecord[]) {
	const groups = new Map<string, CaseCommentGroup>();

	for (const comment of comments.filter((item) => !item.resolved)) {
		const targetType = comment.case ? 'case' : comment.submission ? 'submission' : undefined;
		const targetId = comment.case || comment.submission;
		const target = targetType ? comment.expand?.[targetType] : undefined;
		if (!targetType || !targetId || !target) continue;
		const groupKey = `${targetType}:${targetId}`;
		const group = groups.get(groupKey) ?? { target, targetType, comments: [] };
		group.comments.push(comment);
		groups.set(groupKey, group);
	}

	return [...groups.values()]
		.map((group) => ({
			...group,
			comments: group.comments.sort((a, b) => a.created.localeCompare(b.created))
		}))
		.sort((a, b) =>
			b.comments[b.comments.length - 1].created.localeCompare(
				a.comments[a.comments.length - 1].created
			)
		);
}
