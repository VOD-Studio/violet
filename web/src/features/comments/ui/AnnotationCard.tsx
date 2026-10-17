/**
 * AnnotationCard - 批注卡片（气泡面板内使用）。
 *
 * 与 CommentItem 的差异：
 *   - 顶部引言区用荧光笔底色标出批注锚定的原文
 *   - 回复两层扁平，继承父锚点（子批注共享同一高亮区）
 */
import { getCommentAuthorPresentation } from "@entities/comment/lib/ai-personas";
import type { Comment } from "@entities/comment/model/types";
import { AIBadge } from "@entities/comment/ui/AIBadge";
import { CommentAuthorAvatar } from "@entities/comment/ui/CommentAuthorAvatar";
import { formatRelativeTime } from "@shared/lib/date";
import { AUTHOR_TIER } from "@shared/ui/comment-section";
import { EmojiText } from "@shared/ui/emoji-text";
import PendingBadge from "@shared/ui/pending-badge";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { Crown, MessageCircle } from "lucide-react";
import { useState } from "react";
import type { CommentTreeNode } from "../lib/comment-tree";
import { AnnotationAuthorProfile } from "./AnnotationAuthorProfile";
import { CommentForm } from "./CommentForm";

/** 气泡空间小，回复折叠阈值比评论区更紧 */
const REPLIES_PREVIEW_COUNT = 2;

export interface AnnotationCardProps {
	/** 批注节点（含扁平回复，子批注继承父锚点） */
	node: CommentTreeNode;
	/** 选中原文（引言区展示）。同一 block 的批注共享锚点。 */
	selectedText: string;
	/** 文章 id（回复表单提交用）。不传则不显示回复按钮 */
	postId?: string;
	/** 是否登录（仅登录可回复） */
	isLoggedIn?: boolean;
}

export function AnnotationCard({
	node,
	selectedText,
	postId,
	isLoggedIn = false,
}: AnnotationCardProps) {
	const { comment, replies } = node;
	const { personaId } = getCommentAuthorPresentation(comment);
	const [replying, setReplying] = useState(false);
	const [repliesExpanded, setRepliesExpanded] = useState(false);
	const [pendingReplies, setPendingReplies] = useState<Comment[]>([]);

	// refetch 后新回复进了 node.replies，从 pendingReplies 去重移除
	const replyIds = new Set(replies.map((r) => r.comment.id));
	const visiblePending = pendingReplies.filter((r) => !replyIds.has(r.id));
	const allReplies = [...replies, ...visiblePending.map((r) => ({ comment: r, replies: [] }))];
	const visibleReplies = repliesExpanded
		? allReplies
		: allReplies.slice(0, REPLIES_PREVIEW_COUNT);
	const hiddenCount = allReplies.length - REPLIES_PREVIEW_COUNT;

	return (
		<article
			className={cn(
				"rounded-2xl p-3.5",
				comment.is_ai
					? "bg-(--ai-accent)/8"
					: comment.is_author
						? AUTHOR_TIER.bubble
						: "bg-muted/40",
			)}
			data-ai={comment.is_ai ? "true" : undefined}
			data-ai-persona={personaId}
		>
			<p className="mb-2.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
				<span className="annotation-quote" data-ai-persona={personaId}>
					{selectedText}
				</span>
			</p>

			<CommentMeta comment={comment} time={formatTimeAgo(comment.created_at)} />

			<p className="mt-1.5 whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-foreground">
				<EmojiText text={comment.body} emote={comment.emote} />
			</p>

			{isLoggedIn && postId && (
				<button
					type="button"
					onClick={() => setReplying((v) => !v)}
					className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
					aria-label={replying ? "取消回复" : "回复批注"}
				>
					<MessageCircle className="size-3" />
					<span>回复</span>
				</button>
			)}

			{replying && postId && (
				<div className="mt-2">
					<CommentForm
						postId={postId}
						parentId={comment.id}
						compact
						isLoggedIn={isLoggedIn}
						enableImage={false}
						onSuccess={(newReply) => {
							setPendingReplies((prev) => [...prev, newReply]);
							setReplying(false);
						}}
					/>
				</div>
			)}

			{allReplies.length > 0 && (
				<div className="mt-3 space-y-2">
					{visibleReplies.map((reply) => (
						<AnnotationReply key={reply.comment.id} comment={reply.comment} />
					))}
					{hiddenCount > 0 && (
						<button
							type="button"
							onClick={() => setRepliesExpanded((v) => !v)}
							className="text-xs text-primary hover:underline"
						>
							{repliesExpanded ? "收起" : `展开剩余 ${hiddenCount} 条`}
						</button>
					)}
				</div>
			)}
		</article>
	);
}

/** CommentMeta 批注元信息：头像 + 昵称 + 「回复 @yyy」+ 作者徽章 + 审批中徽章 + 时间 */
function CommentMeta({ comment, time }: { comment: Comment; time: string }) {
	const { displayName } = getCommentAuthorPresentation(comment);
	const isAuthor = !comment.is_ai && comment.is_author;
	const nameClass = isAuthor ? AUTHOR_TIER.name : "font-medium text-foreground";
	const avatar = (
		<CommentAuthorAvatar
			name={comment.author_name}
			avatarUrl={comment.avatar_url}
			isAI={!!comment.is_ai}
		/>
	);
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-2">
			<div className="relative shrink-0">
				{comment.is_ai ? (
					<AnnotationAuthorProfile
						name={comment.author_name}
						className="shrink-0 rounded-full"
					>
						{avatar}
					</AnnotationAuthorProfile>
				) : isAuthor ? (
					<>
						<div className={AUTHOR_TIER.avatarRing}>
							<div className="flex rounded-full bg-background p-px">{avatar}</div>
						</div>
						<span className={cn(AUTHOR_TIER.crown, "size-3.5")} aria-hidden="true">
							<Crown className="size-2" fill="currentColor" />
						</span>
					</>
				) : (
					avatar
				)}
			</div>
			{comment.is_ai ? (
				<AnnotationAuthorProfile
					name={comment.author_name}
					className={cn("min-w-0 max-w-32 truncate text-sm", nameClass)}
				>
					{displayName}
				</AnnotationAuthorProfile>
			) : comment.author_username ? (
				<Link
					to="/users/$username"
					params={{ username: comment.author_username }}
					className={cn("min-w-0 max-w-32 truncate text-sm hover:underline", nameClass)}
				>
					{displayName}
				</Link>
			) : (
				<span className={cn("min-w-0 max-w-32 truncate text-sm", nameClass)}>
					{displayName}
				</span>
			)}
			{comment.reply_to_name && (
				<span className="min-w-0 truncate text-xs text-muted-foreground">
					回复 <span className="text-primary">@{comment.reply_to_name}</span>
				</span>
			)}
			{isAuthor && (
				<span className={AUTHOR_TIER.badge}>
					<Crown className="size-2.5" fill="currentColor" />
					作者
				</span>
			)}
			<AIBadge show={!!comment.is_ai} name={comment.author_name} />
			<PendingBadge show={comment.status === "pending"} />
			<time className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
				{time}
			</time>
		</div>
	);
}

/** AnnotationReply 批注的扁平回复：更紧凑，无引言区 */
function AnnotationReply({ comment }: { comment: Comment }) {
	const { personaId } = getCommentAuthorPresentation(comment);
	return (
		<div
			className={cn(
				"rounded-xl p-2.5",
				comment.is_ai ? "bg-(--ai-accent)/8" : "bg-background/60",
			)}
			data-ai={comment.is_ai ? "true" : undefined}
			data-ai-persona={personaId}
		>
			<CommentMeta comment={comment} time={formatTimeAgo(comment.created_at)} />
			<p className="mt-1 whitespace-pre-wrap wrap-break-word text-xs leading-relaxed text-foreground">
				<EmojiText text={comment.body} emote={comment.emote} />
			</p>
		</div>
	);
}

export default AnnotationCard;

/** formatTimeAgo 与 CommentItem 同样的零值守卫：无效日期或 2000 年前显示「刚刚」 */
function formatTimeAgo(createdAt: string): string {
	const date = new Date(createdAt);
	if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) {
		return "刚刚";
	}
	return formatRelativeTime(date);
}
