import type { Tweet } from "@entities/tweet/model/types";
import type { PagedResponse } from "@shared/api/types";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { tweetKeys } from "./keys";

/** 全局筛选、用户主页与话题各自分页，但共享推文的互动字段。 */
export const timelinePrefixes = [
	tweetKeys.timeline,
	tweetKeys.userTimeline,
	tweetKeys.topicTimeline,
];

export type TweetTimelineCache = InfiniteData<PagedResponse<Tweet>, string | undefined>;

/** 缓存无目标时不写入；返回 null 只从列表移除，详情由删除调用方清理。 */
export function updateCachedTweet(
	qc: QueryClient,
	id: string,
	update: (tweet: Tweet) => Tweet | null,
) {
	qc.setQueryData<Tweet>(tweetKeys.detail(id), (old) => {
		if (!old) return;
		const next = update(old);
		return next && next !== old ? next : undefined;
	});
	for (const queryKey of timelinePrefixes) {
		qc.setQueriesData<TweetTimelineCache>({ queryKey }, (old) => {
			if (!old) return;
			let changed = false;
			const pages = old.pages.map((page) => {
				const index = page.data.findIndex((tweet) => tweet.id === id);
				if (index < 0) return page;
				const current = page.data[index];
				const next = update(current);
				if (next === current) return page;
				changed = true;
				const data = [...page.data];
				if (next) {
					data[index] = next;
				} else {
					data.splice(index, 1);
				}
				return { ...page, data };
			});
			return changed ? { ...old, pages } : undefined;
		});
	}
}
