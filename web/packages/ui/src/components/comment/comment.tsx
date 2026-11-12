"use client";

import { cn } from "cn";
import { Segmented, type SegmentedItem } from "../segmented";
import type {
	CommentHeaderProps,
	CommentListProps,
	CommentRepliesProps,
	CommentSort,
} from "./types";

const SORT_SEGMENTS: SegmentedItem<CommentSort>[] = [
	{ value: "latest", label: "最新" },
	{ value: "hot", label: "最热" },
];

/** 评论区标题与真实受控排序；没有变更回调时不提供不可操作的排序器。 */
export function CommentHeader({
	title,
	count,
	sort = "latest",
	onSortChange,
	className,
	children,
	...props
}: CommentHeaderProps) {
	return (
		<header {...props} data-slot="comment-header" className={cn("v-comment-header", className)}>
			<div className="v-comment-header__title">
				{title}
				{count !== undefined && <span className="v-comment-header__count">{count}</span>}
			</div>
			{children}
			{onSortChange && (
				<Segmented
					value={sort}
					onValueChange={onSortChange}
					segments={SORT_SEGMENTS}
					aria-label="评论排序"
				/>
			)}
		</header>
	);
}

/** 顶层评论 ol；宿主提供直接 li 子节点并管理分页和异步状态。 */
export function CommentList({ className, ...props }: CommentListProps) {
	return <ol {...props} data-slot="comment-list" className={cn("v-comment-list", className)} />;
}

/** 回复 ol；只提供缩进与引导线，不接管展开会话或回复数量。 */
export function CommentReplies({ className, ...props }: CommentRepliesProps) {
	return (
		<ol {...props} data-slot="comment-replies" className={cn("v-comment-replies", className)} />
	);
}
