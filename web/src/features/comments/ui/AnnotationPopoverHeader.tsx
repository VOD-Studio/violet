import { getCommentAuthorPresentation } from "@entities/comment/lib/ai-personas";
import { AIBadge } from "@entities/comment/ui/AIBadge";
import { CommentAuthorAvatar } from "@entities/comment/ui/CommentAuthorAvatar";
import { cn } from "cn";
import { X } from "lucide-react";
import type { AnnotationAuthorFilter } from "../model/types";
import type { AnnotationPopoverTarget } from "./AnnotationPopover";

interface AnnotationPopoverHeaderProps {
	target: AnnotationPopoverTarget;
	onFilter: (author: AnnotationAuthorFilter) => void;
	onClose: () => void;
}

/** 批注计数与身份筛选；重复选择当前身份恢复全部。 */
export function AnnotationPopoverHeader({
	target,
	onFilter,
	onClose,
}: AnnotationPopoverHeaderProps) {
	const showAiBadge =
		target.author === null
			? target.authors.some((author) => author.is_ai)
			: target.author.is_ai;
	return (
		<div className="flex h-14 shrink-0 items-center gap-2 px-4 py-2">
			<span className="shrink-0 whitespace-nowrap text-xs font-medium text-muted-foreground">
				{target.count} 条批注
			</span>
			{showAiBadge && (
				<span className="inline-flex h-6 shrink-0 items-center">
					<AIBadge show name={target.author?.name} />
				</span>
			)}
			{target.authors.length > 1 && (
				<div className="flex h-10 min-w-0 items-center gap-2 overflow-x-auto p-1 [scrollbar-width:none]">
					{target.authors.map((author) => {
						const identity = { name: author.name, is_ai: !!author.is_ai };
						const { displayName, personaId } = getCommentAuthorPresentation({
							author_name: author.name,
							avatar_url: author.avatar_url,
							is_ai: author.is_ai,
						});
						const label = author.is_ai ? `${displayName}（AI）` : displayName;
						const selected =
							target.author !== null &&
							target.author.name === identity.name &&
							target.author.is_ai === identity.is_ai;
						return (
							<button
								key={`${identity.is_ai ? "ai" : "user"}:${identity.name}`}
								type="button"
								title={label}
								aria-label={`只看 ${label}`}
								aria-pressed={selected}
								data-active={selected ? "true" : undefined}
								data-ai={author.is_ai ? "true" : undefined}
								data-ai-persona={personaId}
								onClick={() => onFilter(selected ? null : identity)}
								className={cn(
									"annotation-filter-avatar inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
									target.author && !selected && "opacity-40 hover:opacity-80",
								)}
							>
								<CommentAuthorAvatar
									name={author.name}
									avatarUrl={author.avatar_url}
									isAI={!!author.is_ai}
									className="size-full bg-transparent"
								/>
							</button>
						);
					})}
				</div>
			)}
			<button
				type="button"
				onClick={onClose}
				className="ml-auto inline-flex size-6 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				aria-label="关闭"
			>
				<X className="size-4" />
			</button>
		</div>
	);
}
