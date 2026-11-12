import type { Tweet, TweetComment } from "@entities/tweet/model/types";
import type { PagedResponse } from "@shared/api/types";
import type { QueryClient } from "@tanstack/react-query";
import { tweetKeys } from "./keys";

export type TweetCommentListCache = {
	pages: PagedResponse<TweetComment>[];
	pageParams: (number | undefined)[];
};

type TimelineCache = { pages: PagedResponse<Tweet>[] };

/** 增减当前推文的数量，不覆盖其它推文或并发创建/删除的结果。 */
export function bumpTweetCommentCount(qc: QueryClient, tweetId: string, delta: number) {
	const apply = (tweet: Tweet): Tweet => ({
		...tweet,
		comment_count: Math.max(0, tweet.comment_count + delta),
	});
	qc.setQueryData<Tweet>(tweetKeys.detail(tweetId), (old) => (old ? apply(old) : old));
	const updateTimeline = (old?: TimelineCache): TimelineCache | undefined => {
		if (!old?.pages) {
			return old;
		}
		return {
			...old,
			pages: old.pages.map((page) => ({
				...page,
				data: page.data.map((tweet) => (tweet.id === tweetId ? apply(tweet) : tweet)),
			})),
		};
	};
	qc.setQueriesData<TimelineCache>({ queryKey: tweetKeys.timeline }, updateTimeline);
	qc.setQueriesData<TimelineCache>(
		{ queryKey: [...tweetKeys.all, "userTimeline"] },
		updateTimeline,
	);
}

/** 删除仅保存目标条目；回滚按原相邻项复位，不覆盖其它成功删除或新评论。 */
export function removeTweetCommentFromCaches(qc: QueryClient, commentId: string): () => void {
	const restores: (() => void)[] = [];
	for (const [key, cache] of qc.getQueriesData<TweetCommentListCache>({
		queryKey: [...tweetKeys.all, "comments"],
	})) {
		if (!cache?.pages) {
			continue;
		}
		const pageIndex = cache.pages.findIndex((page) =>
			page.data.some((item) => item.id === commentId),
		);
		if (pageIndex < 0) {
			continue;
		}
		const original = cache.pages[pageIndex].data;
		const index = original.findIndex((item) => item.id === commentId);
		const comment = original[index];
		const nextId = original[index + 1]?.id;
		const previousId = original[index - 1]?.id;
		qc.setQueryData<TweetCommentListCache>(key, (old) => {
			if (!old) {
				return old;
			}
			return {
				...old,
				pages: old.pages.map((page, i) => {
					if (i !== pageIndex) {
						return page;
					}
					return {
						...page,
						data: page.data.filter((item) => item.id !== commentId),
						pagination: {
							...page.pagination,
							total: Math.max(0, (page.pagination.total ?? 0) - 1),
						},
					};
				}),
			};
		});
		restores.push(() => {
			qc.setQueryData<TweetCommentListCache>(key, (old) => {
				if (
					!old ||
					old.pages.some((page) => page.data.some((item) => item.id === commentId))
				) {
					return old;
				}
				return {
					...old,
					pages: old.pages.map((page, i) => {
						if (i !== pageIndex) {
							return page;
						}
						const data = [...page.data];
						const nextIndex = data.findIndex((item) => item.id === nextId);
						const previousIndex = data.findIndex((item) => item.id === previousId);
						let insertionIndex = Math.min(index, data.length);
						if (nextIndex >= 0) {
							insertionIndex = nextIndex;
						} else if (previousIndex >= 0) {
							insertionIndex = previousIndex + 1;
						}
						data.splice(insertionIndex, 0, comment);
						return {
							...page,
							data,
							pagination: {
								...page.pagination,
								total: (page.pagination.total ?? 0) + 1,
							},
						};
					}),
				};
			});
		});
	}
	return () => {
		for (const restore of restores) {
			restore();
		}
	};
}
