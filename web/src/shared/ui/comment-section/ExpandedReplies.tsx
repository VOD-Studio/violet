/**
 * ExpandedReplies - 展开后的追加回复（数据驱动渲染：去重 + 「回复 @yyy」推导 + 分页 + 加载态）
 *
 * 由 feature 的查询包装组件挂载（config.renderExpandedReplies），
 * feature 只负责把它的 React Query hook 结果拍平成 CommentRepliesQuery 传入，
 * 去重 / 标注推导 / 分页按钮 / 加载效果全部在本组件内。
 */
import { ChevronDown, Loader2 } from "lucide-react";
import { CommentItem } from "./CommentItem";
import type { CommentDisplayItem, CommentRaw, CommentSectionConfig } from "./types";

export interface ExpandedRepliesProps<T extends CommentRaw> {
	/** 所属顶层评论 id（「回复 @yyy」推导：parentId ≠ 顶层才是对某回复的回复） */
	topLevelId: string;
	/** 已拉取回复（raw，未去重） */
	replies: T[];
	hasNextPage: boolean;
	fetchNextPage: () => void;
	isFetchingNextPage: boolean;
	isLoading: boolean;
	/** 已展示的回复 id（预览 + 内联 pending），拉取结果跳过它们（纯追加） */
	excludeIds: Set<string>;
	/** 已可见回复（预览 + pending），供「回复 @yyy」按 parentId 推导 */
	knownReplies: CommentDisplayItem<T>[];
	config: CommentSectionConfig<T>;
	isLoggedIn: boolean;
	onReplyAdded: (reply: CommentDisplayItem<T>) => void;
}

export function ExpandedReplies<T extends CommentRaw>({
	topLevelId,
	replies,
	hasNextPage,
	fetchNextPage,
	isFetchingNextPage,
	isLoading,
	excludeIds,
	knownReplies,
	config,
	isLoggedIn,
	onReplyAdded,
}: ExpandedRepliesProps<T>) {
	const mapped = replies.filter((r) => !excludeIds.has(r.id)).map(config.map);
	// 「回复 @yyy」推导：回复另一条回复（parentId ≠ 顶层）时标对方作者名。
	// 后端 reply_to_name 优先（文章），没有则由 parentId 从可见回复推导（推文）。
	const authorById = new Map<string, string>();
	for (const r of [...knownReplies, ...mapped]) authorById.set(r.id, r.authorName);

	return (
		<>
			{mapped.map((reply) => (
				<CommentItem
					key={reply.id}
					item={{
						...reply,
						replyToName:
							reply.replyToName ??
							(reply.parentId && reply.parentId !== topLevelId
								? authorById.get(reply.parentId)
								: undefined),
					}}
					level={1}
					isLoggedIn={isLoggedIn}
					config={config}
					onReplyAdded={onReplyAdded}
				/>
			))}

			{/* 首次加载效果（展开后第一页还在路上） */}
			{(isLoading || isFetchingNextPage) && mapped.length === 0 && (
				<div className="flex items-center gap-1 py-1 pl-1 text-xs text-muted-foreground">
					<Loader2 className="size-3 animate-spin" />
					加载中...
				</div>
			)}

			{/* 底部「查看更多回复」按钮 */}
			{hasNextPage && (
				<button
					type="button"
					onClick={fetchNextPage}
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
		</>
	);
}

export default ExpandedReplies;
