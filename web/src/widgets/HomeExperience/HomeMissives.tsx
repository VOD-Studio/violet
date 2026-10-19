import { getCommentAuthorPresentation } from "@entities/comment/lib/ai-personas";
import type { AdminComment } from "@entities/comment/model/types";
import { AIBadge } from "@entities/comment/ui/AIBadge";
import { AICommentProfile } from "@entities/comment/ui/AICommentProfile";
import { CommentAuthorAvatar } from "@entities/comment/ui/CommentAuthorAvatar";
import { EmojiText } from "@shared/ui/emoji-text";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "@violet/ui";

interface HomeMissivesProps {
	missives: AdminComment[];
	isLoading: boolean;
}

/** 首页尺素橱窗，展示最新来信与评论者。 */
export function HomeMissives({ missives, isLoading }: HomeMissivesProps) {
	return (
		<div>
			<div className="mb-5">
				<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
					MISSIVES
				</p>
				<h2 className="mt-2 font-serif text-[1.75rem] font-normal leading-tight tracking-[0.08em] text-foreground sm:text-3xl">
					尺素
				</h2>
			</div>

			{isLoading ? (
				<div aria-live="polite" className="space-y-4">
					{[0, 1].map((i) => (
						<div key={i} className="space-y-2 border-l border-border/80 pl-3.5">
							<Skeleton className="h-3.5 w-full rounded" />
							<Skeleton className="h-3.5 w-5/6 rounded" />
							<Skeleton className="h-3 w-24 rounded" />
						</div>
					))}
				</div>
			) : missives.length > 0 ? (
				<div className="space-y-4">
					{missives.map((comment) => (
						<article key={comment.id} className="border-l border-border/80 pl-3.5">
							<p className="line-clamp-3 font-serif text-[13px] leading-relaxed text-foreground/80">
								<EmojiText text={comment.body} emote={comment.emote} />
							</p>
							<HomeMissiveAuthor comment={comment} />
						</article>
					))}
				</div>
			) : (
				<article className="text-xs text-muted-foreground">
					<p className="font-serif text-[13px] italic leading-relaxed text-muted-foreground">
						一纸相闻，落笔为记。欢迎通过邮件，或在文章与推文下方留言。
					</p>
					<p className="mt-2 text-[11px] text-muted-foreground/75">— 站长回笺</p>
				</article>
			)}
		</div>
	);
}

function HomeMissiveAuthor({ comment }: { comment: AdminComment }) {
	const { displayName } = getCommentAuthorPresentation(comment);
	const avatar = (
		<CommentAuthorAvatar
			name={comment.author_name}
			avatarUrl={comment.avatar_url}
			isAI={!!comment.is_ai}
			className="size-4 text-[9px]"
		/>
	);
	return (
		<p className="mt-2 flex items-center justify-start gap-1.5 text-[11px] text-muted-foreground/75">
			<span aria-hidden>—</span>
			{comment.is_ai ? (
				<AICommentProfile name={comment.author_name} className="shrink-0 rounded-full">
					{avatar}
				</AICommentProfile>
			) : (
				avatar
			)}
			<span className="flex min-w-0 items-center gap-1.5">
				<span className="-m-1 min-w-0 truncate p-1">
					{comment.is_ai ? (
						<AICommentProfile name={comment.author_name}>
							{displayName}
						</AICommentProfile>
					) : (
						displayName
					)}
					{comment.post_slug ? (
						<>
							{" · "}
							<Link
								to="/blog/$slug"
								params={{ slug: comment.post_slug }}
								className="transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
							>
								《{comment.post_title}》
							</Link>
						</>
					) : null}
				</span>
				<AIBadge show={!!comment.is_ai} name={comment.author_name} />
			</span>
		</p>
	);
}
