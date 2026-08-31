export interface CommentCaseRecord {
	id: string;
	case_id: string;
	title: string;
}

export interface CaseCommentRecord {
	id: string;
	case: string;
	content: string;
	author: string;
	resolved: boolean;
	resolved_by?: string;
	resolved_at?: string;
	created: string;
	updated: string;
	expand?: {
		case?: CommentCaseRecord;
		author?: { id: string; email: string; name?: string; username?: string };
		resolved_by?: { id: string; email: string; name?: string; username?: string };
	};
}

export interface CaseCommentGroup {
	caseRecord: CommentCaseRecord;
	comments: CaseCommentRecord[];
}

export function groupOpenComments(comments: CaseCommentRecord[]) {
	const groups = new Map<string, CaseCommentGroup>();

	for (const comment of comments.filter((item) => !item.resolved)) {
		const caseRecord = comment.expand?.case;
		if (!caseRecord) continue;

		const group = groups.get(comment.case) ?? { caseRecord, comments: [] };
		group.comments.push(comment);
		groups.set(comment.case, group);
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
