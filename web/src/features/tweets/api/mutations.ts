/** tweets feature 写操作层（发推文 / 删除推文 + 缓存联动） */

import type { Tweet, TweetComment } from "@entities/tweet/model/types";
import { apiDelete, apiPost } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateTweetCommentInput, CreateTweetInput } from "../model/types";
import {
	bumpTweetCommentCount,
	type TweetCommentListCache as CommentListCache,
	removeTweetCommentFromCaches,
} from "./comment-cache";
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
				if (old.pages.some((page) => page.data.some((item) => item.id === tweet.id))) {
					return {
						...old,
						pages: old.pages.map((page) => ({
							...page,
							data: page.data.map((item) => (item.id === tweet.id ? tweet : item)),
						})),
					};
				}
				const [first, ...rest] = old.pages;
				return {
					...old,
					pages: [{ ...first, data: [tweet, ...first.data] }, ...rest],
				};
			});
			qc.setQueryData(tweetKeys.detail(tweet.id), tweet);
			void qc.invalidateQueries({ queryKey: [...tweetKeys.all, "userTimeline"] });
		},
	});
};

export const useManageExternalTweet = (id: string, operation: "refresh" | "withdraw") => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () =>
			operation === "withdraw"
				? apiDelete(`/tweets/external/${id}`)
				: apiPost(`/tweets/external/${id}/refresh`, {}),
		// 刷新可能先确认原文失效再返回错误；所有引用与聊天缓存都重新读取。
		onSettled: () => qc.invalidateQueries(),
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

// --- 推文评论（P2 / issue #108）---

/**
 * useCreateTweetComment - 发评论 / 回复（登录，即发即出）
 *
 * 成功后即时更新各排序列表与详情/时间线数量；顶层评论插入首页后，
 * 等待 hot 列表从后端刷新，不能把「最新插入」当成热度排序。
 *
 * @param tweetId 所属推文 ID（路由参数，写操作 URL 需要）
 */
export const useCreateTweetComment = (tweetId: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateTweetCommentInput) =>
			apiPost<TweetComment>(`/tweets/${tweetId}/comments`, input),
		onSuccess: async (comment, input) => {
			bumpTweetCommentCount(qc, tweetId, 1);
			if (input.parent_id) {
				// 回复：追加到对应顶层评论的回复列表末尾（回复按 created_at 正序）
				qc.setQueriesData<CommentListCache>(
					{ queryKey: tweetKeys.replies(input.parent_id) },
					(old) => {
						if (!old?.pages.length) {
							return old;
						}
						const pages = [...old.pages];
						const last = pages[pages.length - 1];
						pages[pages.length - 1] = {
							data: [...last.data, comment],
							pagination: {
								...last.pagination,
								total: (last.pagination.total ?? 0) + 1,
							},
						};
						return { ...old, pages };
					},
				);
			} else {
				// 顶层评论：插到列表首页顶部（顶层按 created_at 倒序，最新在前）
				qc.setQueriesData<CommentListCache>(
					{ queryKey: tweetKeys.commentList(tweetId) },
					(old) => {
						if (!old?.pages.length) {
							return old;
						}
						const [first, ...rest] = old.pages;
						return {
							...old,
							pages: [
								{
									data: [comment, ...first.data],
									pagination: {
										...first.pagination,
										total: (first.pagination.total ?? 0) + 1,
									},
								},
								...rest,
							],
						};
					},
				);
				await qc.invalidateQueries({ queryKey: tweetKeys.commentListOf(tweetId, "hot") });
			}
		},
	});
};

/**
 * useDeleteTweetComment - 删除评论（登录，作者本人或 tweet:delete-any）
 *
 * 乐观删除：onMutate 即时从所有评论缓存移除该评论并 comment_count -1（即时消失），
 * 失败回滚；成功后失效详情缓存重取权威 comment_count（顶层评论删除会级联其回复，
 * 客户端 -1 是低估，重取纠正）。鉴权双重判定在后端应用层。
 *
 * @param tweetId 所属推文 ID（路由参数，写操作 URL 需要）
 */
export const useDeleteTweetComment = (tweetId: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (commentId: string) =>
			apiDelete<null>(`/tweets/${tweetId}/comments/${commentId}`),
		onMutate: async (commentId) => {
			await qc.cancelQueries({ queryKey: [...tweetKeys.all, "comments"] });
			await qc.cancelQueries({ queryKey: tweetKeys.detail(tweetId) });
			await qc.cancelQueries({ queryKey: tweetKeys.timeline });
			await qc.cancelQueries({ queryKey: [...tweetKeys.all, "userTimeline"] });

			const rollback = removeTweetCommentFromCaches(qc, commentId);
			// 只做本次增量；失败加回时保留期间创建/删除造成的数量变化。
			bumpTweetCommentCount(qc, tweetId, -1);
			return { rollback };
		},
		onError: (_err, _id, context) => {
			toast.error("删除失败，请重试");
			if (context) {
				context.rollback();
				bumpTweetCommentCount(qc, tweetId, 1);
			}
		},
		onSuccess: () => {
			// 重取详情拿权威 comment_count（顶层评论删除级联回复，-1 是低估）
			return qc.invalidateQueries({ queryKey: tweetKeys.detail(tweetId) });
		},
	});
};
