/** tweets feature 写操作层（发推文 / 删除推文 + 缓存联动） */

import type { Tweet } from "@entities/tweet/model/types";
import { apiDelete, apiPost } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
			qc.setQueriesData<TimelineCache>({ queryKey: tweetKeys.timeline }, (old) => {
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

/**
 * useDeleteTweet - 删除推文（作者本人或 tweet:delete-any）
 *
 * 成功后清理所有缓存：从全局时间线各页移除该推文，并移除其详情缓存。
 * 鉴权双重判定在后端应用层；前端仅按 useMe 决定按钮可见性。
 *
 * @param id 推文 ID
 */
export const useDeleteTweet = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => apiDelete<null>(`/tweets/${id}`),
		onSuccess: () => {
			// 从所有时间线缓存（各 limit 维度）的每一页移除该推文
			qc.setQueriesData<TimelineCache>({ queryKey: tweetKeys.timeline }, (old) => {
				if (!old || old.pages.length === 0) return old;
				return {
					...old,
					pages: old.pages.map((page) => ({
						...page,
						data: page.data.filter((t) => t.id !== id),
					})),
				};
			});
			// 详情缓存移除：删除后详情不再可访问
			qc.removeQueries({ queryKey: tweetKeys.detail(id) });
		},
	});
};
/**
 * useToggleLikeTweet - 点赞 / 取消点赞推文（乐观更新 + 失败回滚）
 *
 * @param tweet 当前推文读模型
 */
export const useToggleLikeTweet = (tweet: Tweet) => {
	const qc = useQueryClient();
	const isLiked = tweet.is_liked;
	const delta = isLiked ? -1 : 1;
	const nextIsLiked = !isLiked;
	const id = tweet.id;

	return useMutation({
		mutationFn: () =>
			isLiked
				? apiDelete<unknown>(`/tweets/${id}/like`)
				: apiPost<unknown>(`/tweets/${id}/like`, {}),
		onMutate: async () => {
			await qc.cancelQueries({ queryKey: tweetKeys.detail(id) });
			await qc.cancelQueries({ queryKey: tweetKeys.timeline });
			await qc.cancelQueries({ queryKey: [...tweetKeys.all, "userTimeline"] });

			const prevDetail = qc.getQueryData<Tweet>(tweetKeys.detail(id));
			const prevTimelines = qc.getQueriesData<TimelineCache>({
				queryKey: tweetKeys.timeline,
			});
			const prevUserTimelines = qc.getQueriesData<TimelineCache>({
				queryKey: [...tweetKeys.all, "userTimeline"],
			});

			qc.setQueryData<Tweet>(tweetKeys.detail(id), (old) =>
				old
					? {
							...old,
							is_liked: nextIsLiked,
							like_count: Math.max(0, old.like_count + delta),
						}
					: old,
			);

			const updateCache = (old?: TimelineCache) => {
				if (!old?.pages) return old;
				return {
					...old,
					pages: old.pages.map((page) => ({
						...page,
						data: page.data.map((t) =>
							t.id === id
								? {
										...t,
										is_liked: nextIsLiked,
										like_count: Math.max(0, t.like_count + delta),
									}
								: t,
						),
					})),
				};
			};

			qc.setQueriesData<TimelineCache>({ queryKey: tweetKeys.timeline }, updateCache);
			qc.setQueriesData<TimelineCache>(
				{ queryKey: [...tweetKeys.all, "userTimeline"] },
				updateCache,
			);

			return { prevDetail, prevTimelines, prevUserTimelines };
		},
		onError: (_err, _vars, context) => {
			toast.error("操作失败，请重试");
			if (context?.prevDetail) {
				qc.setQueryData(tweetKeys.detail(id), context.prevDetail);
			}
			if (context?.prevTimelines) {
				for (const [key, data] of context.prevTimelines) {
					qc.setQueryData(key, data);
				}
			}
			if (context?.prevUserTimelines) {
				for (const [key, data] of context.prevUserTimelines) {
					qc.setQueryData(key, data);
				}
			}
		},
	});
};
