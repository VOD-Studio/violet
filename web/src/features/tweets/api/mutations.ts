/** tweets feature 写操作层（发推文 + 时间线缓存乐观插入） */

import type { Tweet } from "@entities/tweet/model/types";
import { apiPost } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateTweetInput } from "../model/types";
import { tweetKeys } from "./keys";

/** useInfiniteQuery 的缓存结构（pages + pageParams） */
type TimelineCache = {
	pages: PagedResponse<Tweet>[];
	pageParams: (string | undefined)[];
};

/**
 * useCreateTweet - 发推文
 *
 * @returns useMutation；onSuccess 已把新推文插到时间线首页顶部
 */
export const useCreateTweet = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateTweetInput) => apiPost<Tweet>("/tweets", input),
		onSuccess: (tweet) => {
			// 时间线未挂载时（用户不在 /tweets）无匹配缓存，setQueriesData 是 no-op，
			// 下次进入会重新拉取最新列表，无需额外 invalidate。
			qc.setQueriesData<TimelineCache>({ queryKey: tweetKeys.timeline() }, (old) => {
				if (!old || old.pages.length === 0) return old;
				const [first, ...rest] = old.pages;
				return {
					...old,
					pages: [{ ...first, data: [tweet, ...first.data] }, ...rest],
				};
			});
		},
	});
};
