/** 公开的全局或话题时间线，登录者可发布，所有人可按 cursor 加载更多。 */

import { useMe } from "@features/auth/api/queries";
import { useTimeline, useTopicTimeline } from "@features/tweets/api/queries";
import { Button, Empty, ShimmerSkeleton } from "@violet/ui";

import TweetCard from "./TweetCard";
import { TweetComposer } from "./TweetComposer";

export interface TweetTimelineProps {
	/** 每页条数，默认走 TIMELINE_PAGE_SIZE */
	limit?: number;
	/** 话题标签（提供时渲染话题流而非全局流） */
	tag?: string;
}

export function TweetTimeline({ limit, tag }: TweetTimelineProps = {}) {
	const me = useMe();
	const isLoggedIn = !!me.data;

	const globalQuery = useTimeline(limit, !tag);
	const topicQuery = useTopicTimeline(tag ?? "", limit);
	const activeQuery = tag ? topicQuery : globalQuery;

	const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
		activeQuery;

	const tweets = data?.pages.flatMap((p) => p.data ?? []) ?? [];
	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
			{isLoggedIn && <TweetComposer />}

			{isLoading ? (
				<div className="flex flex-col gap-4">
					{Array.from({ length: 3 }).map((_, i) => (
						<ShimmerSkeleton key={i} className="h-48 w-full rounded-2xl" />
					))}
				</div>
			) : isError ? (
				<Empty
					title="加载失败"
					description={error instanceof Error ? error.message : "未知错误"}
					className="py-20"
				/>
			) : tweets.length === 0 ? (
				<Empty
					title="还没有推文"
					description={
						tag
							? `暂无 #${tag}# 话题下的推文`
							: isLoggedIn
								? "发布第一条推文吧"
								: "登录后发布第一条推文"
					}
					className="py-20"
				/>
			) : (
				<>
					<div className="flex flex-col gap-4">
						{tweets.map((tweet) => (
							<TweetCard key={tweet.id} tweet={tweet} />
						))}
					</div>
					{hasNextPage && (
						<div className="flex justify-center py-2">
							<Button
								variant="outline"
								loading={isFetchingNextPage}
								loadingText="加载中…"
								onClick={() => fetchNextPage()}
								disabled={isFetchingNextPage}
							>
								加载更多
							</Button>
						</div>
					)}
				</>
			)}
		</div>
	);
}

export default TweetTimeline;
