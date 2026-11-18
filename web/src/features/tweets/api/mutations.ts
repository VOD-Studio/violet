/** tweets feature 写操作层（发推文 / 删除推文 + 缓存联动） */

import type { Tweet, TweetComment } from "@entities/tweet/model/types";
import { apiDelete, apiPost } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreateTweetCommentInput, CreateTweetInput } from "../model/types";
import {
	bumpTweetCommentCount,
	type TweetCommentListCache as CommentListCache,
	removeTweetCommentFromCaches,
} from "./comment-cache";
import { tweetDetailContexts } from "./detail-context";
import { tweetKeys } from "./keys";
import { type TweetTimelineCache, timelinePrefixes, updateCachedTweet } from "./timeline-cache";

/** 发布后在符合筛选的时间线插入首屏，保留原游标边界。 */
export const useCreateTweet = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: CreateTweetInput) => apiPost<Tweet>("/tweets", input),
		onSuccess: async (tweet) => {
			const publicationPrefixes = [tweetKeys.timelineSorted("latest")];
			if (tweet.images.length > 0)
				publicationPrefixes.push(tweetKeys.timelineSorted("images"));

			await Promise.all(
				publicationPrefixes.map((queryKey) => qc.cancelQueries({ queryKey })),
			);
			for (const queryKey of publicationPrefixes) {
				qc.setQueriesData<TweetTimelineCache>({ queryKey }, (old) => {
					if (
						!old?.pages.length ||
						old.pages.some((page) => page.data.some(({ id }) => id === tweet.id))
					) {
						return undefined;
					}
					const [first, ...rest] = old.pages;
					return { ...old, pages: [{ ...first, data: [tweet, ...first.data] }, ...rest] };
				});
				// 如果发布时恰好打断了首屏请求，重新启动它，而不是等待下一次导航。
				void qc.invalidateQueries({
					queryKey,
					predicate: (query) => query.state.data === undefined,
				});
			}
			qc.setQueryData<Tweet>(tweetKeys.detail(tweet.id), (old) => ({
				...tweet,
				view_count: Math.max(tweet.view_count, old?.view_count ?? 0),
			}));
			void qc.invalidateQueries({ queryKey: tweetKeys.sidebar });
			void qc.invalidateQueries({ queryKey: tweetKeys.timelineSorted("hot") });
			void qc.invalidateQueries({ queryKey: tweetKeys.userTimeline });
			void qc.invalidateQueries({ queryKey: tweetKeys.topicTimeline });
			if (tweet.quote_of) {
				void qc.invalidateQueries({ queryKey: tweetKeys.detail(tweet.quote_of) });
				void qc.invalidateQueries({ queryKey: tweetKeys.timelineSorted("latest") });
				void qc.invalidateQueries({ queryKey: tweetKeys.timelineSorted("images") });
			}
			void qc.invalidateQueries({ queryKey: tweetDetailContexts });
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

/** 删除后立即移出已读时间线，再刷新服务端排序与侧栏。 */
export const useDeleteTweet = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => apiDelete<null>(`/tweets/${id}`),
		onSuccess: async () => {
			await Promise.all(timelinePrefixes.map((queryKey) => qc.cancelQueries({ queryKey })));
			updateCachedTweet(qc, id, () => null);
			qc.removeQueries({ queryKey: tweetKeys.detail(id) });
			// 已删除原文的引用快照、引用总数和作者累计统计都需重新读取。
			void qc.invalidateQueries({ queryKey: tweetKeys.details });
			void qc.invalidateQueries({ queryKey: tweetDetailContexts });
			for (const queryKey of timelinePrefixes) void qc.invalidateQueries({ queryKey });
			void qc.invalidateQueries({ queryKey: tweetKeys.sidebar });
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
			await Promise.all([
				qc.cancelQueries({ queryKey: tweetKeys.detail(id), exact: true }),
				...timelinePrefixes.map((queryKey) => qc.cancelQueries({ queryKey })),
			]);
			updateCachedTweet(qc, id, (current) => ({
				...current,
				is_liked: nextIsLiked,
				like_count: Math.max(0, current.like_count + delta),
			}));
		},
		onError: () => {
			toast.error("操作失败，请重试");
			updateCachedTweet(qc, id, (current) =>
				current.is_liked === nextIsLiked
					? {
							...current,
							is_liked: isLiked,
							like_count: Math.max(0, current.like_count - delta),
						}
					: current,
			);
		},
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: tweetDetailContexts });
		},
		onSettled: () => {
			void qc.invalidateQueries({ queryKey: tweetKeys.timelineSorted("hot") });
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
			void qc.invalidateQueries({ queryKey: tweetKeys.timelineSorted("hot") });
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
			await Promise.all([
				qc.cancelQueries({ queryKey: [...tweetKeys.all, "comments"] }),
				qc.cancelQueries({ queryKey: tweetKeys.detail(tweetId), exact: true }),
				...timelinePrefixes.map((queryKey) => qc.cancelQueries({ queryKey })),
			]);

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
			void qc.invalidateQueries({ queryKey: tweetKeys.timelineSorted("hot") });
			return qc.invalidateQueries({ queryKey: tweetKeys.detail(tweetId), exact: true });
		},
	});
};
