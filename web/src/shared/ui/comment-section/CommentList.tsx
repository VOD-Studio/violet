/**
 * CommentList - 评论列表（顶层扁平渲染，回复在 CommentItem 内按需展开）
 *
 * 文章评论与推文评论共用：loading 骨架 / 错误重试 / 空态 / 列表 / 加载更多。
 * 文章侧在外层包 ReactionProvider 批量拉反应（展开回复不在此范围，由 CommentReactions 自行降级）。
 */
import { Button, Empty, Skeleton } from "@violet/ui";

import { CommentItem } from "./CommentItem";
import type { CommentRaw, CommentSectionConfig } from "./types";

export interface CommentListProps<T extends CommentRaw> {
	/** 顶层评论（feature 分页结果拍平） */
	comments: T[];
	/** feature 适配配置 */
	config: CommentSectionConfig<T>;
	/** 是否登录（透传 CommentItem，决定回复按钮可见性） */
	isLoggedIn: boolean;
	/** 首屏加载中 */
	isLoading?: boolean;
	/** 首屏加载失败（网络/500）；有已加载内容时保留列表，仅在空列表时展示错误 */
	error?: unknown;
	/** 首屏失败后的重试回调 */
	onRetry?: () => void;
	/** 加载更多回调（滚动加载下一页）。无更多时为 undefined */
	onLoadMore?: () => void;
	/** 是否正在加载下一页（显示加载态） */
	isLoadingMore?: boolean;
}

export function CommentList<T extends CommentRaw>({
	comments,
	config,
	isLoggedIn,
	isLoading = false,
	error,
	onRetry,
	onLoadMore,
	isLoadingMore = false,
}: CommentListProps<T>) {
	if (isLoading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-20 w-full rounded-2xl" />
				<Skeleton className="h-20 w-full rounded-2xl" />
			</div>
		);
	}

	if (error && comments.length === 0) {
		return (
			<Empty
				title="评论加载失败"
				description="网络似乎不太顺畅，稍后再试一次。"
				action={
					onRetry && (
						<Button variant="outline" size="sm" onClick={() => onRetry()}>
							重试
						</Button>
					)
				}
			/>
		);
	}

	if (comments.length === 0) {
		return <Empty title="还没有评论" description="成为第一个评论的人" />;
	}

	return (
		<div className="space-y-7">
			{comments.map((raw) => (
				<CommentItem
					key={raw.id}
					item={config.map(raw)}
					level={0}
					isLoggedIn={isLoggedIn}
					config={config}
				/>
			))}
			{onLoadMore && (
				<div className="flex justify-center py-2">
					<Button variant="ghost" size="sm" onClick={onLoadMore} disabled={isLoadingMore}>
						{isLoadingMore ? "加载中..." : "加载更多"}
					</Button>
				</div>
			)}
		</div>
	);
}

export default CommentList;
