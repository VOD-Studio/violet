/** tweets feature 写操作层（发推文 / 删除推文 + 缓存联动） */

import type { Tweet, TweetComment } from "@entities/tweet/model/types";
import { apiDelete, apiPost } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import {
	type QueryClient,
	type QueryKey,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateTweetCommentInput, CreateTweetInput } from "../model/types";
import { tweetKeys } from "./keys";

/** useInfiniteQuery 的缓存结构（pages + pageParams） */
type TimelineCache = {
	pages: PagedResponse<Tweet>[];
	pageParams: (string | undefined)[];
};

/** useInfiniteQuery 的评论缓存结构（顶层评论列表 / 回复列表共用） */
type CommentListCache = {
	pages: PagedResponse<TweetComment>[];
	pageParams: (number | undefined)[];
};

/** 详情与时间线缓存快照（删除评论回滚用） */
interface CountCacheSnapshot {
	prevDetail: Tweet | undefined;
	prevTimelines: [QueryKey, TimelineCache | undefined][];
	prevUserTimelines: [QueryKey, TimelineCache | undefined][];
}

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

// --- 推文评论（P2 / issue #108）---

/** bumpTweetCommentCount - 把 comment_count ± delta 同步到详情与全部时间线缓存 */
function bumpTweetCommentCount(qc: QueryClient, tweetId: string, delta: number) {
	const apply = (t: Tweet): Tweet => ({
		...t,
		comment_count: Math.max(0, t.comment_count + delta),
	});
	qc.setQueryData<Tweet>(tweetKeys.detail(tweetId), (old) => (old ? apply(old) : old));
	const updateTimeline = (old?: TimelineCache): TimelineCache | undefined => {
		if (!old?.pages) return old;
		return {
			...old,
			pages: old.pages.map((page) => ({
				...page,
				data: page.data.map((t) => (t.id === tweetId ? apply(t) : t)),
			})),
		};
	};
	qc.setQueriesData<TimelineCache>({ queryKey: tweetKeys.timeline }, updateTimeline);
	qc.setQueriesData<TimelineCache>(
		{ queryKey: [...tweetKeys.all, "userTimeline"] },
		updateTimeline,
	);
}

/** captureCountCaches - 快照详情与全部时间线缓存，供删除回滚用 */
function captureCountCaches(qc: QueryClient, tweetId: string): CountCacheSnapshot {
	return {
		prevDetail: qc.getQueryData<Tweet>(tweetKeys.detail(tweetId)),
		prevTimelines: qc.getQueriesData<TimelineCache>({ queryKey: tweetKeys.timeline }),
		prevUserTimelines: qc.getQueriesData<TimelineCache>({
			queryKey: [...tweetKeys.all, "userTimeline"],
		}),
	};
}

/** restoreCountCaches - 用快照恢复详情与全部时间线缓存 */
function restoreCountCaches(qc: QueryClient, tweetId: string, snap: CountCacheSnapshot) {
	if (snap.prevDetail) qc.setQueryData(tweetKeys.detail(tweetId), snap.prevDetail);
	for (const [k, d] of snap.prevTimelines) qc.setQueryData(k, d);
	for (const [k, d] of snap.prevUserTimelines) qc.setQueryData(k, d);
}

/**
 * useCreateTweetComment - 发评论 / 回复（登录，即发即出）
 *
 * 成功后即时更新缓存（无需重拉）：顶层评论插到列表首页顶部，回复追加到对应
 * 顶层评论的回复列表；同时 comment_count +1 同步到详情与全部时间线。
 *
 * @param tweetId 所属推文 ID（路由参数，写操作 URL 需要）
 */
export const useCreateTweetComment = (tweetId: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateTweetCommentInput) =>
			apiPost<TweetComment>(`/tweets/${tweetId}/comments`, input),
		onSuccess: (comment, input) => {
			bumpTweetCommentCount(qc, tweetId, 1);
			if (input.parent_id) {
				// 回复：追加到对应顶层评论的回复列表末尾（回复按 created_at 正序）
				qc.setQueriesData<CommentListCache>(
					{ queryKey: tweetKeys.replies(input.parent_id) },
					(old) => {
						if (!old?.pages.length) return old;
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
						if (!old?.pages.length) return old;
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

			// 快照评论缓存（顶层列表 + 各回复列表），供回滚
			const prevComments = qc.getQueriesData<CommentListCache>({
				queryKey: [...tweetKeys.all, "comments"],
			});
			const snap = captureCountCaches(qc, tweetId);

			// 即时从所有评论缓存移除该 id（顶层列表 / 回复列表均可能命中）
			qc.setQueriesData<CommentListCache>(
				{ queryKey: [...tweetKeys.all, "comments"] },
				(old) => {
					if (!old?.pages) return old;
					let removed = false;
					const pages = old.pages.map((page) => {
						const next = page.data.filter((c) => c.id !== commentId);
						if (next.length === page.data.length) return page;
						removed = true;
						return {
							data: next,
							pagination: {
								...page.pagination,
								total: Math.max(0, (page.pagination.total ?? 0) - 1),
							},
						};
					});
					return removed ? { ...old, pages } : old;
				},
			);
			// 即时 comment_count -1（回复精确；顶层因级联回列为低估，onSuccess 重取纠正）
			bumpTweetCommentCount(qc, tweetId, -1);

			return { prevComments, snap };
		},
		onError: (_err, _id, context) => {
			toast.error("删除失败，请重试");
			if (context?.prevComments) {
				for (const [key, data] of context.prevComments) {
					qc.setQueryData(key, data);
				}
			}
			if (context?.snap) restoreCountCaches(qc, tweetId, context.snap);
		},
		onSuccess: () => {
			// 重取详情拿权威 comment_count（顶层评论删除级联回复，-1 是低估）
			qc.invalidateQueries({ queryKey: tweetKeys.detail(tweetId) });
		},
	});
};
