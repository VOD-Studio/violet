/** tweets feature 查询层（cursor 分页时间线） */

import type { Tweet } from "@entities/tweet/model/types";
import { apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { TweetTimelineQuery } from "../model/types";
import { TIMELINE_PAGE_SIZE, tweetKeys } from "./keys";

/**
 * fetchTimeline - 调后端 GET /tweets 拉全局时间线（公开，cursor 分页）
 */
export const fetchTimeline = async (
	query: TweetTimelineQuery = {},
): Promise<PagedResponse<Tweet>> => apiGetPaged<Tweet>("/tweets", { params: query });

/**
 * useTimeline - 全局时间线 hook（cursor 滚动加载）
 *
 * @param limit 每页条数，默认 20
 */
export const useTimeline = (limit: number = TIMELINE_PAGE_SIZE) =>
	useInfiniteQuery({
		queryKey: tweetKeys.timeline(limit),
		queryFn: ({ pageParam }) => fetchTimeline({ cursor: pageParam, limit }),
		// 首页无 cursor；pageParam 类型为 string | undefined
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.pagination?.next_cursor || undefined,
	});
