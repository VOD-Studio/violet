/**
 * TweetCommentSection - 推文详情页评论区容器
 *
 * 与文章评论（features/comments CommentSection）同构但简化：
 *   - 匿名可读评论，登录可发评论 / 回复
 *   - 顶层评论 page/limit 滚动加载（最新在前），回复在 TweetCommentItem 内按需拉
 *
 * 数据流：useInfiniteQuery 滚动加载顶层评论，每页 10 条。
 */

import { useMe } from "@features/auth/api/queries";
import { Button } from "@shared/ui/base/button";
import Empty from "@shared/ui/empty";
import { ShimmerSkeleton } from "@shared/ui/shimmer-skeleton";
import { MessageSquare } from "lucide-react";
import { useTweetComments } from "../api/queries";
import { TweetCommentForm } from "./TweetCommentForm";
import { TweetCommentItem } from "./TweetCommentItem";

export interface TweetCommentSectionProps {
	/** 所属推文 id */
	tweetId: string;
}

export function TweetCommentSection({ tweetId }: TweetCommentSectionProps) {
	const me = useMe();
	const isLoggedIn = !!me.data;
	const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
		useTweetComments(tweetId);

	const comments = data?.pages.flatMap((p) => p.data) ?? [];
	const total = data?.pages[0]?.pagination?.total ?? 0;

	return (
		<section className="flex flex-col gap-3" aria-label="评论区">
			<div className="flex items-center gap-2 text-sm font-medium text-foreground">
				<MessageSquare className="size-4" />
				<span>评论 {total > 0 ? total : ""}</span>
			</div>

			<TweetCommentForm tweetId={tweetId} isLoggedIn={isLoggedIn} />

			{isLoading ? (
				<div className="space-y-2">
					<ShimmerSkeleton className="h-16 w-full rounded-lg" />
					<ShimmerSkeleton className="h-16 w-full rounded-lg" />
				</div>
			) : comments.length === 0 ? (
				<Empty title="还没有评论" description="成为第一个评论的人" size="sm" />
			) : (
				<div className="divide-y divide-edge-hairline">
					{comments.map((comment) => (
						<TweetCommentItem
							key={comment.id}
							comment={comment}
							tweetId={tweetId}
							isLoggedIn={isLoggedIn}
						/>
					))}
				</div>
			)}

			{hasNextPage && (
				<div className="flex justify-center py-2">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => fetchNextPage()}
						disabled={isFetchingNextPage}
					>
						{isFetchingNextPage ? "加载中..." : "加载更多"}
					</Button>
				</div>
			)}
		</section>
	);
}

export default TweetCommentSection;
