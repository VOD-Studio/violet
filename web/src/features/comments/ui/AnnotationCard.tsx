/**
 * 批注卡里的一条讨论：顶部引用被批注的原文，其下依次是批注与回复。
 */
import { getCommentAuthorPresentation } from "@entities/comment/lib/ai-personas";
import type { Comment } from "@entities/comment/model/types";
import { AIBadge } from "@entities/comment/ui/AIBadge";
import { CommentAuthorAvatar } from "@entities/comment/ui/CommentAuthorAvatar";
import { formatRelativeTime } from "@shared/lib/date";
import { EmojiText } from "@shared/ui/emoji-text";
import PendingBadge from "@shared/ui/pending-badge";
import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { type ReactNode, useState } from "react";
import { AnnotationAuthorProfile } from "./AnnotationAuthorProfile";
import { AnnotationOverlayContext } from "./annotation-overlay-context";
import { CommentForm } from "./CommentForm";

/** 卡片空间小，回复折叠阈值比评论区更紧 */
const REPLIES_PREVIEW_COUNT = 2;

export interface AnnotationThreadProps {
	/** 被批注的原文；整段批注为整段文字，由卡片限高 */
	quote: string;
	/** 同一处划线的顶层批注，每条带自己的回复 */
	comments: Comment[];
	postId: string;
	isLoggedIn: boolean;
	/** 评论者筛选：不满足的批注只隐藏不卸载，回复草稿得以保留；省略为全部显示 */
	isVisible?: (comment: Comment) => boolean;
	/** 批注卡当前是否可交互；被筛掉的批注里的作者介绍等浮层随之停用 */
	active?: boolean;
}

export function AnnotationThread({
	quote,
	comments,
	postId,
	isLoggedIn,
	isVisible = () => true,
	active = true,
}: AnnotationThreadProps) {
	const shown = comments.map(isVisible);
	return (
		<section className="annotation-thread" hidden={!shown.some(Boolean)}>
			<blockquote className="annotation-quote">{quote}</blockquote>
			<ul className="annotation-items">
				{comments.map((comment, index) => (
					<AnnotationOverlayContext key={comment.id} value={active && shown[index]}>
						<AnnotationEntry
							comment={comment}
							postId={postId}
							isLoggedIn={isLoggedIn}
							hidden={!shown[index]}
						/>
					</AnnotationOverlayContext>
				))}
			</ul>
		</section>
	);
}

/** 一条批注、它的回复表单与回复；回复继承父批注的锚点。 */
function AnnotationEntry({
	comment,
	postId,
	isLoggedIn,
	hidden,
}: {
	comment: Comment;
	postId: string;
	isLoggedIn: boolean;
	hidden: boolean;
}) {
	const [replying, setReplying] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const [pendingReplies, setPendingReplies] = useState<Comment[]>([]);
	const { displayName } = getCommentAuthorPresentation(comment);

	// 只折叠进入卡片时超出预览的回复；本次新发或重拉带回的回复始终可见。
	const [collapsedIds] = useState(
		() =>
			new Set((comment.replies ?? []).slice(REPLIES_PREVIEW_COUNT).map((reply) => reply.id)),
	);
	// refetch 后新回复进了 comment.replies，从 pendingReplies 去重移除
	const known = new Set((comment.replies ?? []).map((reply) => reply.id));
	const replies = [
		...(comment.replies ?? []),
		...pendingReplies.filter((reply) => !known.has(reply.id)),
	];
	const shownReplies = expanded
		? replies
		: replies.filter((reply) => !collapsedIds.has(reply.id));
	const hiddenCount = replies.filter((reply) => collapsedIds.has(reply.id)).length;

	return (
		<li className="annotation-entry" hidden={hidden}>
			<AnnotationItem
				comment={comment}
				action={
					isLoggedIn && (
						<button
							type="button"
							className="annotation-reply-button"
							aria-label={replying ? "取消回复" : `回复 ${displayName}`}
							aria-expanded={replying}
							onClick={() => setReplying((open) => !open)}
						>
							<MessageCircle className="size-3" aria-hidden="true" />
							回复
						</button>
					)
				}
			/>
			{replying && (
				<div className="annotation-reply-form">
					<CommentForm
						postId={postId}
						parentId={comment.id}
						compact
						isLoggedIn={isLoggedIn}
						enableImage={false}
						onSuccess={(created) => {
							setPendingReplies((prev) => [...prev, created]);
							setReplying(false);
						}}
					/>
				</div>
			)}
			{replies.length > 0 && (
				<ul className="annotation-items annotation-replies">
					{shownReplies.map((reply) => (
						<li key={reply.id}>
							<AnnotationItem
								comment={reply}
								replyToName={
									reply.parent_id === comment.id ? undefined : reply.reply_to_name
								}
							/>
						</li>
					))}
					{hiddenCount > 0 && (
						<li>
							<button
								type="button"
								className="annotation-reply-button"
								onClick={() => setExpanded((open) => !open)}
							>
								{expanded ? "收起" : `展开剩余 ${hiddenCount} 条`}
							</button>
						</li>
					)}
				</ul>
			)}
		</li>
	);
}

function AnnotationItem({
	comment,
	action,
	replyToName,
}: {
	comment: Comment;
	action?: ReactNode;
	/** 直接回复批注时不标注目标；回复其他回复时即使同名也要标注。 */
	replyToName?: string;
}) {
	const { displayName, personaId } = getCommentAuthorPresentation(comment);
	const isAuthor = !comment.is_ai && comment.is_author;
	const avatar = (
		<CommentAuthorAvatar
			name={comment.author_name}
			avatarUrl={comment.avatar_url}
			isAI={!!comment.is_ai}
		/>
	);
	return (
		<div
			className="annotation-item"
			data-ai={comment.is_ai ? "true" : undefined}
			data-ai-persona={personaId}
		>
			{comment.is_ai ? (
				<AnnotationAuthorProfile
					name={comment.author_name}
					className="shrink-0 rounded-full"
				>
					{avatar}
				</AnnotationAuthorProfile>
			) : (
				avatar
			)}
			<div className="min-w-0 flex-1">
				<div className="annotation-item-meta">
					<AuthorName comment={comment} displayName={displayName} />
					{replyToName && (
						<span className="annotation-item-reply-to">回复 @{replyToName}</span>
					)}
					{isAuthor && <span className="annotation-author-tag">作者</span>}
					<AIBadge show={!!comment.is_ai} name={comment.author_name} />
					<PendingBadge show={comment.status === "pending"} />
					<time className="annotation-item-time">
						{formatTimeAgo(comment.created_at)}
					</time>
				</div>
				<p className="annotation-item-text">
					<EmojiText text={comment.body} emote={comment.emote} />
				</p>
				{action}
			</div>
		</div>
	);
}

function AuthorName({ comment, displayName }: { comment: Comment; displayName: string }) {
	if (comment.is_ai) {
		return (
			<AnnotationAuthorProfile name={comment.author_name} className="annotation-item-name">
				{displayName}
			</AnnotationAuthorProfile>
		);
	}
	if (comment.author_username) {
		return (
			<Link
				to="/users/$username"
				params={{ username: comment.author_username }}
				className="annotation-item-name hover:underline"
			>
				{displayName}
			</Link>
		);
	}
	return <span className="annotation-item-name">{displayName}</span>;
}

/** 无效日期或 2000 年前的零值显示「刚刚」，与评论区一致。 */
function formatTimeAgo(createdAt: string): string {
	const date = new Date(createdAt);
	if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return "刚刚";
	return formatRelativeTime(date);
}
