/**
 * TweetCommentItem - 单条推文评论（两层扁平楼中楼）
 *
 * 与文章评论（features/comments）的楼中楼交互同构，但更简单：
 *   - depth=0 顶层评论：头像 + 用户名 + 正文 + 回复按钮 + 删除按钮 + 回复区
 *   - depth=1 回复：同结构但无回复区（两层扁平，回复不再深嵌套）
 *   - 回复另一条回复时 depth 仍为 1，对话关系靠「回复 @yyy」标注
 *
 * 回复区（仅顶层）：后端 CommentDTO 不带 reply_count，故「查看回复」始终可点，
 * 点击后按需 GET /tweets/{id}/comments/{topLevelId}/replies 拉取（懒加载，非首屏 N 请求）。
 * 「回复 @yyy」由回复列表内 parent_id ≠ 顶层 id 的回复推导（client-side 拼对话关系）。
 */

import type { TweetComment } from "@entities/tweet/model/types";
import { useMe } from "@features/auth/api/queries";
import { useHasPermission } from "@features/auth/hooks/usePermissions";
import { avatarUrl } from "@shared/lib/image-url";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronDown, Loader2, MessageCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDeleteTweetComment } from "../api/mutations";
import { useTweetReplies } from "../api/queries";
import { TweetCommentForm } from "./TweetCommentForm";

export interface TweetCommentItemProps {
	/** 当前评论（顶层 depth=0 或回复 depth=1） */
	comment: TweetComment;
	/** 所属推文 id（写操作 URL 需要） */
	tweetId: string;
	/** 是否登录（决定是否显示回复按钮） */
	isLoggedIn: boolean;
	/** 回复对象用户名（reply-to-reply 标注「回复 @yyy」）；顶层 / 直接回复顶层时省略 */
	replyToName?: string;
	/** 回复提交回调（回复层由顶层 item 传入，冒泡到顶层 pendingReplies） */
	onReplyAdded?: (reply: TweetComment) => void;
}

export function TweetCommentItem({
	comment,
	tweetId,
	isLoggedIn,
	replyToName,
	onReplyAdded,
}: TweetCommentItemProps) {
	const me = useMe();
	const canDeleteAny = useHasPermission("tweet:delete-any");
	const deleteComment = useDeleteTweetComment(tweetId);
	const [replying, setReplying] = useState(false);
	/** 顶层评论下内联提交的回复（立即显示，无需展开拉取） */
	const [pendingReplies, setPendingReplies] = useState<TweetComment[]>([]);

	const isTopLevel = comment.depth === 0;
	const isAuthor = !!me.data && me.data.id === comment.author.id;
	// 作者本人 或 持 tweet:delete-any 权限者可删（鉴权双重判定在后端应用层）
	const canDelete = !!me.data && (isAuthor || canDeleteAny);
	// 相对时间（容错：解析失败或异常年份回退「刚刚」）
	const commentDate = new Date(comment.created_at);
	const timeAgo =
		Number.isNaN(commentDate.getTime()) || commentDate.getFullYear() < 2000
			? "刚刚"
			: formatDistanceToNow(commentDate, { addSuffix: true, locale: zhCN });

	const handleReplySuccess = (reply: TweetComment) => {
		if (isTopLevel) {
			setPendingReplies((prev) => [...prev, reply]);
		} else {
			// 回复层的内联回复冒泡到顶层 item 的 pendingReplies
			onReplyAdded?.(reply);
		}
		setReplying(false);
	};

	return (
		<div className="group relative py-3">
			<div className="flex gap-3">
				<img
					src={avatarUrl(comment.author.avatar_url, comment.author.username)}
					alt={comment.author.username}
					loading="lazy"
					className="size-8 shrink-0 rounded-full object-cover"
				/>
				<div className="min-w-0 flex-1">
					{/* 元信息：用户名 + 回复标注 + 时间 */}
					<div className="flex items-center gap-2">
						<Link
							to="/users/$username"
							params={{ username: comment.author.username }}
							className="truncate text-sm font-medium text-foreground hover:underline"
						>
							{comment.author.username}
						</Link>
						{replyToName && (
							<span className="text-xs text-muted-foreground">
								回复 <span className="text-primary">@{replyToName}</span>
							</span>
						)}
						<time
							className="ml-auto shrink-0 text-xs text-muted-foreground"
							title={comment.created_at}
						>
							{timeAgo}
						</time>
					</div>

					{/* 正文 */}
					<p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
						{comment.body}
					</p>

					{/* 操作：回复（登录） + 删除（作者 / 管理员） */}
					<div className="mt-1.5 flex items-center gap-3">
						{isLoggedIn && (
							<button
								type="button"
								onClick={() => setReplying((v) => !v)}
								className="inline-flex h-6 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
								aria-label={replying ? "取消回复" : "回复"}
							>
								<MessageCircle className="size-3.5" />
								<span>回复</span>
							</button>
						)}
						{canDelete && (
							<button
								type="button"
								aria-label="删除评论"
								onClick={() => deleteComment.mutate(comment.id)}
								disabled={deleteComment.isPending}
								className="inline-flex h-6 items-center text-xs text-muted-foreground opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
							>
								<Trash2 className="size-3.5" />
							</button>
						)}
					</div>

					{/* 内联回复表单：点回复图标后展开 */}
					{replying && isLoggedIn && (
						<div className="mt-2">
							<TweetCommentForm
								tweetId={tweetId}
								parentId={comment.id}
								compact
								isLoggedIn={isLoggedIn}
								onSuccess={handleReplySuccess}
							/>
						</div>
					)}
				</div>
			</div>

			{/* 回复区：仅顶层评论渲染（两层扁平，回复不再嵌套回复区） */}
			{isTopLevel && (
				<TweetCommentRepliesBlock
					topLevelId={comment.id}
					tweetId={tweetId}
					isLoggedIn={isLoggedIn}
					pendingReplies={pendingReplies}
					onReplyAdded={(reply) => setPendingReplies((prev) => [...prev, reply])}
				/>
			)}
		</div>
	);
}

/**
 * TweetCommentRepliesBlock - 顶层评论下的回复区（懒加载 + 纯追加 + 分页）。
 *
 * 后端 CommentDTO 无 reply_count，无法预知是否有回复，故「查看回复」始终可点：
 *   - 点击展开 → useTweetReplies 拉首页回复，渲染时去重内联 pending
 *   - 「查看更多回复」在底部，fetchNextPage 继续追加
 *   - 收起后保留状态（再次展开命中缓存，不重拉）
 */
function TweetCommentRepliesBlock({
	topLevelId,
	tweetId,
	isLoggedIn,
	pendingReplies,
	onReplyAdded,
}: {
	topLevelId: string;
	tweetId: string;
	isLoggedIn: boolean;
	pendingReplies: TweetComment[];
	onReplyAdded: (reply: TweetComment) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useTweetReplies(
		tweetId,
		topLevelId,
	);

	const fetchedReplies = data?.pages.flatMap((p) => p.data) ?? [];
	// 去重：refetch 后内联 pending 可能已进列表，跳过重复
	const fetchedIds = new Set(fetchedReplies.map((r) => r.id));
	const visiblePending = pendingReplies.filter((r) => !fetchedIds.has(r.id));
	const allReplies = [...fetchedReplies, ...visiblePending];
	// id → username，用于推导「回复 @yyy」（parent_id ≠ 顶层 id 的回复是对某回复的回复）
	const authorById = new Map<string, string>();
	for (const r of allReplies) authorById.set(r.id, r.author.username);

	return (
		<div className="mt-1 space-y-1 border-l border-edge-hairline pl-3">
			{expanded &&
				allReplies.map((reply) => (
					<TweetCommentItem
						key={reply.id}
						comment={reply}
						tweetId={tweetId}
						isLoggedIn={isLoggedIn}
						replyToName={
							reply.parent_id && reply.parent_id !== topLevelId
								? authorById.get(reply.parent_id)
								: undefined
						}
						onReplyAdded={onReplyAdded}
					/>
				))}

			{expanded && isFetchingNextPage && fetchedReplies.length === 0 && (
				<div className="flex items-center gap-1 py-1 pl-1 text-xs text-muted-foreground">
					<Loader2 className="size-3 animate-spin" />
					加载中...
				</div>
			)}

			{expanded && hasNextPage && (
				<button
					type="button"
					onClick={() => fetchNextPage()}
					disabled={isFetchingNextPage}
					className="flex items-center gap-1 py-1 pl-1 text-xs text-primary hover:underline disabled:opacity-50"
				>
					{isFetchingNextPage ? (
						<>
							<Loader2 className="size-3 animate-spin" />
							加载中...
						</>
					) : (
						<>
							<ChevronDown className="size-3" />
							查看更多回复
						</>
					)}
				</button>
			)}

			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				className="flex items-center gap-1 py-1 pl-1 text-xs text-primary hover:underline"
			>
				<ChevronDown
					className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`}
				/>
				{expanded ? "收起回复" : "查看回复"}
			</button>
		</div>
	);
}

export default TweetCommentItem;
