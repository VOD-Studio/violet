/**
 * CommentRepliesBlock - 顶层评论下的回复区（预览 / toggle + 懒加载 + 纯追加 + 分页）
 *
 * 两种模式（CommentSectionConfig.repliesMode）：
 *   - preview（文章）：后端返回 comment.replies 预览 + replies_total，
 *     显示预览 + 「查看全部 N 条回复」按钮，点击后懒加载分页
 *   - toggle（推文）：后端返回 replies_count（无预览），有回复才显示
 *     「查看回复」按钮，点击后懒加载分页，可「收起回复」
 *
 * 渲染策略（纯追加，无替换，避免视觉抖动）：
 *   1. 预览（preview 模式）与内联 pending 永远显示——位置不动
 *   2. 展开后经 config.renderExpandedReplies 挂载 feature 的查询组件（懒加载），
 *      新增回复追加在下方，「查看更多回复」继续分页
 *   3. 「回复 @yyy」标注：后端 reply_to_name 优先，没有则由 parentId 从可见回复推导
 */
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { CommentItem } from "./CommentItem";
import type { CommentDisplayItem, CommentRaw, CommentSectionConfig } from "./types";

export interface CommentRepliesBlockProps<T extends CommentRaw> {
	/** 顶层评论（其 repliesPreview / repliesTotal 来自后端或省略） */
	comment: CommentDisplayItem<T>;
	isLoggedIn: boolean;
	config: CommentSectionConfig<T>;
	/** 顶层评论下内联提交的回复（立即显示） */
	pendingReplies: CommentDisplayItem<T>[];
	onReplyAdded: (reply: CommentDisplayItem<T>) => void;
}

export function CommentRepliesBlock<T extends CommentRaw>({
	comment,
	isLoggedIn,
	config,
	pendingReplies,
	onReplyAdded,
}: CommentRepliesBlockProps<T>) {
	const [expanded, setExpanded] = useState(false);

	const previewReplies =
		config.repliesMode === "preview" ? (comment.repliesPreview ?? []).map(config.map) : [];
	const previewIds = new Set(previewReplies.map((r) => r.id));
	// refetch 后新回复可能进了预览，此时不重复显示
	const visiblePending = pendingReplies.filter((r) => !previewIds.has(r.id));
	const visibleCount = previewReplies.length + visiblePending.length;
	const allExcludedIds = new Set([...previewIds, ...pendingReplies.map((r) => r.id)]);
	// 已可见回复（预览 + pending），供「回复 @yyy」按 parentId 推导
	const knownReplies = [...previewReplies, ...visiblePending];

	const renderReply = (reply: CommentDisplayItem<T>) => (
		<CommentItem
			key={reply.id}
			item={reply}
			level={1}
			isLoggedIn={isLoggedIn}
			config={config}
			onReplyAdded={onReplyAdded}
		/>
	);

	return (
		<div className="mt-2 space-y-2 border-l border-edge-hairline pl-3">
			{/* 预览回复（preview 模式，位置不动） */}
			{previewReplies.map(renderReply)}

			{/* 刚提交的回复（尾部追加） */}
			{visiblePending.map(renderReply)}

			{/* 展开后的追加回复：feature 查询组件懒加载挂载（去重预览 + pending） */}
			{expanded &&
				config.renderExpandedReplies({
					topLevelId: comment.id,
					excludeIds: allExcludedIds,
					knownReplies,
					isLoggedIn,
					onReplyAdded,
				})}

			{/* 展开按钮：preview=「查看全部 N 条回复」；toggle=「查看回复 / 收起回复」 */}
			{config.repliesMode === "preview"
				? !expanded &&
					comment.repliesTotal !== undefined &&
					comment.repliesTotal > visibleCount && (
						<button
							type="button"
							onClick={() => setExpanded(true)}
							className="flex items-center gap-1 text-xs text-primary hover:underline"
						>
							<ChevronDown className="size-3" />
							查看全部 {comment.repliesTotal} 条回复
						</button>
					)
				: (comment.repliesTotal === undefined || (comment.repliesTotal ?? 0) > 0) && (
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
					)}
		</div>
	);
}

export default CommentRepliesBlock;
