/**
 * tweets feature 查询层
 *
 * 全部走 shared/api/request 的封装（httpClient 已自动 withCredentials +
 * 解 envelope + 注入 CSRF），业务层只拿 PagedResponse / 业务数据。
 *
 * cursor 分页是本仓库首个生产消费方：pageParam = 上一页 next_cursor，
 * 首页为 undefined（不带 cursor 参数）。
 */

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
