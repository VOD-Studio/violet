/** tweets feature 查询层（cursor 分页时间线） */

import type { Tweet } from "@entities/tweet/model/types";
import type { UserProfile } from "@entities/user/model/types";
import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
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
		queryKey: tweetKeys.timelineOf(limit),
		queryFn: ({ pageParam }) => fetchTimeline({ cursor: pageParam, limit }),
		// 首页无 cursor；pageParam 类型为 string | undefined
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.pagination?.next_cursor || undefined,
	});

/**
 * fetchTweetDetail - 调后端 GET /tweets/{id} 拉单条推文详情（公开）
 */
export const fetchTweetDetail = (id: string): Promise<Tweet> => apiGet<Tweet>(`/tweets/${id}`);

/**
 * useTweetDetail - 单条推文详情 hook
 *
 * 匿名可访问。详情页通过 route loader ensureQueryData 预取首屏，
 * 此 hook 跟踪同一 queryKey 保证导航后即时命中缓存。
 */
export const useTweetDetail = (id: string) =>
	useQuery({
		queryKey: tweetKeys.detail(id),
		queryFn: () => fetchTweetDetail(id),
		enabled: !!id,
	});
/**
 * fetchUserProfile - 调后端 GET /users/{username} 拉公开用户资料（公开）
 */
export const fetchUserProfile = (username: string): Promise<UserProfile> =>
	apiGet<UserProfile>(`/users/${username}`);

/**
 * useUserProfile - 用户公开资料卡 hook
 */
export const useUserProfile = (username: string) =>
	useQuery({
		queryKey: tweetKeys.userProfile(username),
		queryFn: () => fetchUserProfile(username),
		enabled: !!username,
	});

/**
 * fetchUserTimeline - 调后端 GET /users/{username}/tweets 拉用户推文列表（公开，cursor 分页）
 */
export const fetchUserTimeline = async (
	username: string,
	query: TweetTimelineQuery = {},
): Promise<PagedResponse<Tweet>> =>
	apiGetPaged<Tweet>(`/users/${username}/tweets`, { params: query });

/**
 * useUserTimeline - 用户推文列表 hook（cursor 滚动加载）
 */
export const useUserTimeline = (username: string, limit: number = TIMELINE_PAGE_SIZE) =>
	useInfiniteQuery({
		queryKey: tweetKeys.userTimelineOf(username, limit),
		queryFn: ({ pageParam }) => fetchUserTimeline(username, { cursor: pageParam, limit }),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.pagination?.next_cursor || undefined,
		enabled: !!username,
	});
