/**
 * CommentList - 评论列表（顶层扁平渲染，回复在 CommentItem 内按需展开）
 *
 * 文章评论与推文评论共用：loading 骨架 / 空态 / 列表 / 加载更多。
 * 文章侧在外层包 ReactionProvider 批量拉反应（展开回复不在此范围，由 ReactionBar 自行降级）。
 */
import { Button } from "@shared/ui/base/button";
import Empty from "@shared/ui/empty";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
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
	onLoadMore,
	isLoadingMore = false,
}: CommentListProps<T>) {
	if (isLoading) {
		return (
			<div className="space-y-3">
				<ShimmerSkeleton className="h-24 w-full rounded-xl" />
				<ShimmerSkeleton className="h-24 w-full rounded-xl" />
			</div>
		);
	}

	if (comments.length === 0) {
		return <Empty title="还没有评论" description="成为第一个评论的人" size="sm" />;
	}

	return (
		<div className="space-y-3">
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
