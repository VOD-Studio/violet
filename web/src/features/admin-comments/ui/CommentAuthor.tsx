import { getCommentAuthorPresentation } from "@entities/comment/lib/ai-personas";
import { AIBadge } from "@entities/comment/ui/AIBadge";
import { AICommentProfile } from "@entities/comment/ui/AICommentProfile";
import { CommentAuthorAvatar } from "@entities/comment/ui/CommentAuthorAvatar";
import type { AdminComment } from "@features/admin-comments/model/types";

interface CommentAuthorProps {
	row: AdminComment;
	className?: string;
}

/** 后台作者列；AI 的头像和署名各自打开形象介绍。 */
export function CommentAuthor({ row }: { row: AdminComment }) {
	return (
		<div className="flex min-w-0 items-center gap-2">
			<AdminCommentAvatar row={row} />
			<AdminCommentName row={row} className="min-w-0 truncate text-sm" />
			<AIBadge show={!!row.is_ai} name={row.author_name} />
		</div>
	);
}

export function AdminCommentAvatar({ row, className }: CommentAuthorProps) {
	const avatar = (
		<CommentAuthorAvatar
			name={row.author_name}
			avatarUrl={row.avatar_url}
			isAI={!!row.is_ai}
			className={className}
		/>
	);
	return row.is_ai ? (
		<AICommentProfile name={row.author_name} className="shrink-0 self-start rounded-full">
			{avatar}
		</AICommentProfile>
	) : (
		avatar
	);
}

export function AdminCommentName({ row, className }: CommentAuthorProps) {
	const { displayName } = getCommentAuthorPresentation(row);
	return row.is_ai ? (
		<AICommentProfile name={row.author_name} className={className}>
			<span className="truncate">{displayName}</span>
		</AICommentProfile>
	) : (
		<span className={className}>{displayName}</span>
	);
}
