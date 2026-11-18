/** 公开的全局或话题时间线，登录者可发布，所有人可按 cursor 加载更多。 */

import type { TweetTimelineSort } from "@entities/tweet/model/types";
import { useMe } from "@features/auth/api/queries";
import { timelineOptions, useTimeline, useTopicTimeline } from "@features/tweets/api/queries";
import { ApiError } from "@shared/api/error";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Empty, Skeleton } from "@violet/ui";
import { type ReactNode, useMemo, useRef } from "react";
import TweetCard from "./TweetCard";
import { TweetComposer } from "./TweetComposer";
import { TWEET_DISCOVERY_ID, TweetFeedRails } from "./TweetFeedRails";

/** 全局与指定话题的公开游标时间线。 */
export interface TweetTimelineProps {
	limit?: number;
	/** 提供标签时只加载该话题，不应用全局筛选。 */
	tag?: string;
	sort?: TweetTimelineSort;
	header?: ReactNode;
}

export function TweetTimeline({ limit, tag, sort = "latest", header }: TweetTimelineProps = {}) {
	const qc = useQueryClient();
	const timelineTop = useRef<HTMLDivElement>(null);
	const me = useMe();
	const isLoggedIn = !!me.data;
	const globalQuery = useTimeline(limit, !tag, sort);
	const topicQuery = useTopicTimeline(tag ?? "", limit);
	const activeQuery = tag ? topicQuery : globalQuery;
	const {
		data,
		error,
		isError,
		isFetching,
		isFetchingNextPage,
		isFetchNextPageError,
		fetchNextPage,
		hasNextPage,
		refetch,
	} = activeQuery;
	const tweets = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);
	const expired =
		!tag &&
		sort === "hot" &&
		error instanceof ApiError &&
		error.code === "TWEET_HOT_CURSOR_EXPIRED";
	const loadError = isFetchNextPageError ? "更多推文加载失败" : "推文加载失败";
	const emptyHint = tag
		? `暂无 #${tag}# 话题下的推文`
		: {
				latest: isLoggedIn ? "发布第一条推文吧" : "登录后发布第一条推文",
				hot: "最近 30 天暂无热门推文",
				images: "切换到最新查看全部推文",
			}[sort];

	async function restartHotTimeline() {
		const options = timelineOptions("hot", limit);
		await qc.invalidateQueries({
			queryKey: options.queryKey,
			exact: true,
			refetchType: "none",
		});
		// 旧页保留到新快照首页成功；不能带已失效的游标重试。
		try {
			await qc.fetchInfiniteQuery({ ...options, pages: 1 });
			timelineTop.current?.scrollIntoView({ block: "start" });
		} catch {
			// Query 保留旧页和错误，原位显示重试入口。
		}
	}

	return (
		<div
			ref={timelineTop}
			className={tag ? "mx-auto max-w-3xl" : "mx-auto max-w-280 scroll-mt-24"}
		>
			{header}
			{!tag && (
				<div className="mt-3 lg:hidden">
					<Button asChild variant="link" size="sm">
						<a href={`#${TWEET_DISCOVERY_ID}`}>浏览作者、话题与图片</a>
					</Button>
				</div>
			)}
			<div
				className={
					tag
						? "mt-6"
						: "mt-6 grid items-start gap-6 lg:mt-9 lg:grid-cols-[minmax(0,40rem)_minmax(16rem,1fr)] lg:gap-12 xl:gap-18"
				}
			>
				<section aria-label="推文时间线" className="flex min-w-0 flex-col gap-4">
					{isLoggedIn && <TweetComposer quickAccess />}
					{!data && !isError && (
						<div
							role="status"
							aria-busy="true"
							aria-label="正在加载推文"
							className="flex flex-col gap-4"
						>
							{["first", "second", "third"].map((slot) => (
								<Skeleton key={slot} className="h-48 w-full rounded-2xl" />
							))}
						</div>
					)}
					{data && !isError && tweets.length === 0 && (
						<Empty
							title={sort === "images" && !tag ? "还没有带图片的推文" : "还没有推文"}
							description={emptyHint}
							className="py-20"
						/>
					)}
					{tweets.map((tweet) => (
						<TweetCard key={tweet.id} tweet={tweet} />
					))}
					{isError && (
						<Empty
							variant="plain"
							title={expired ? "热门榜已更新" : loadError}
							description={
								expired
									? "已读推文仍在，重新加载可查看最新热门榜。"
									: "请重试加载推文。"
							}
							action={
								<Button
									variant="outline"
									loading={isFetching}
									loadingText="加载中…"
									onClick={() => {
										if (expired) {
											void restartHotTimeline();
										} else if (isFetchNextPageError) {
											void fetchNextPage();
										} else {
											void refetch();
										}
									}}
								>
									{expired ? "重新加载热门首页" : "重试"}
								</Button>
							}
						/>
					)}
					{hasNextPage && !isError && (
						<div className="flex justify-center py-2">
							<Button
								variant="outline"
								loading={isFetchingNextPage}
								loadingText="加载中…"
								onClick={() => void fetchNextPage()}
								disabled={isFetching}
							>
								加载更多
							</Button>
						</div>
					)}
				</section>
				{!tag && <TweetFeedRails />}
			</div>
		</div>
	);
}

export default TweetTimeline;
