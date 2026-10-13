import { avatarUrl as resolveAvatarUrl } from "@shared/lib/image-url";
import { cn } from "cn";
import { getCommentAuthorPresentation } from "../lib/ai-personas";
import "./ai-personas.css";

/** AI 头像仅取自角色表，不能透传 PAT 持有人的头像。 */
export interface CommentAuthorAvatarProps {
	name: string;
	avatarUrl?: string;
	isAI: boolean;
	className?: string;
}

/** 评论、批注与后台共享的头像；没有真人头像时使用文字回退。 */
export function CommentAuthorAvatar({
	name,
	avatarUrl,
	isAI,
	className,
}: CommentAuthorAvatarProps) {
	const author = getCommentAuthorPresentation({
		author_name: name,
		avatar_url: avatarUrl,
		is_ai: isAI,
	});
	return (
		<span
			className={cn(
				"inline-flex aspect-square size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-medium text-muted-foreground",
				isAI && "bg-(--ai-accent)/10 text-(--ai-accent)",
				className,
			)}
			data-ai-persona={author.personaId}
			title={author.displayName}
		>
			{author.avatarUrl ? (
				<img
					src={isAI ? author.avatarUrl : resolveAvatarUrl(author.avatarUrl)}
					alt={author.displayName}
					className="size-full object-cover"
					loading="lazy"
				/>
			) : (
				author.initials
			)}
		</span>
	);
}
