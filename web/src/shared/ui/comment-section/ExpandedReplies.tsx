/**
 * ExpandedReplies - 展开后的追加回复（数据驱动渲染：去重 + 「回复 @yyy」推导 + 分页 + 加载态）
 *
 * 由 feature 的查询包装组件挂载（config.renderExpandedReplies），
 * feature 只负责把它的 React Query hook 结果拍平成 CommentRepliesQuery 传入，
 * 去重 / 标注推导 / 分页按钮 / 加载效果全部在本组件内。
 */
import { Spinner } from "@violet/ui";
import { ChevronDown } from "lucide-react";
import { CommentItem } from "./CommentItem";
import type { CommentDisplayItem, CommentRaw, CommentSectionConfig } from "./types";

export interface ExpandedRepliesProps<T extends CommentRaw> {
	/** 所属顶层评论 id（「回复 @yyy」推导：parentId ≠ 顶层才是对某回复的回复） */
	topLevelId: string;
	/** 已拉取回复（raw，未去重） */
	replies: T[];
	/**
	 * 本次追加页在原始 replies 中的起点；历史页不累计入场延迟。
	 *
	 * @default 0
	 */
	newBatchStart?: number;
	hasNextPage: boolean;
	fetchNextPage: () => void;
	isFetchingNextPage: boolean;
	isLoading: boolean;
	/** 首次加载失败（网络/500）；已有内容时保留列表，仅在无内容时展示错误与重试 */
	error?: unknown;
	/** 失败后的重试回调 */
	onRetry?: () => void;
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
	newBatchStart = 0,
	hasNextPage,
	fetchNextPage,
	isFetchingNextPage,
	isLoading,
	error,
	onRetry,
	excludeIds,
	knownReplies,
	config,
	isLoggedIn,
	onReplyAdded,
}: ExpandedRepliesProps<T>) {
	const mapped: CommentDisplayItem<T>[] = [];
	let visibleBatchStart = 0;
	for (let index = 0; index < replies.length; index += 1) {
		const reply = replies[index];
		if (excludeIds.has(reply.id)) {
			continue;
		}
		if (index < newBatchStart) {
			visibleBatchStart += 1;
		}
		mapped.push(config.map(reply));
	}
	// 「回复 @yyy」推导：回复另一条回复（parentId ≠ 顶层）时标对方作者名。
	// 后端 reply_to_name 优先（文章），没有则由 parentId 从可见回复推导（推文）。
	const authorById = new Map<string, string>();
	for (const reply of [...knownReplies, ...mapped]) {
		authorById.set(reply.id, reply.authorName);
	}

	return (
		<>
			{mapped.map((reply, index) => {
				let replyToName = reply.replyToName;
				if (reply.parentId === topLevelId) {
					replyToName = undefined;
				} else if (!replyToName && reply.parentId) {
					replyToName = authorById.get(reply.parentId);
				}
				return (
					<li key={reply.id}>
						<CommentItem
							item={{ ...reply, replyToName }}
							level={1}
							isLoggedIn={isLoggedIn}
							config={config}
							onReplyAdded={onReplyAdded}
							enterDelay={Math.max(0, index - visibleBatchStart) * 40}
						/>
					</li>
				);
			})}

			{error && mapped.length === 0 && !isLoading && (
				<li>
					<p className="flex items-center gap-2 py-1 pl-1 text-xs text-muted-foreground">
						回复加载失败
						{onRetry && (
							<button
								type="button"
								onClick={() => onRetry()}
								className="text-primary hover:underline"
							>
								重试
							</button>
						)}
					</p>
				</li>
			)}

			{hasNextPage && (
				<li>
					<button
						type="button"
						onClick={fetchNextPage}
						disabled={isFetchingNextPage}
						className="flex items-center gap-1 py-1 pl-1 text-xs text-primary hover:underline disabled:opacity-50"
					>
						{isFetchingNextPage ? (
							<>
								<Spinner size={16} aria-hidden="true" />
								加载中...
							</>
						) : (
							<>
								<ChevronDown className="size-3" aria-hidden="true" />
								查看更多回复
							</>
						)}
					</button>
				</li>
			)}
		</>
	);
}

export default ExpandedReplies;
