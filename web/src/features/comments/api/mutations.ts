import type { Comment } from "@entities/comment/model/types";
import { addSelfReaction, removeSelfReaction } from "@entities/reaction/lib/optimistic";
import { useMe } from "@features/auth/api/queries";
import { findCachedEmoji } from "@features/emojis/api/cache";
import { apiDelete, apiPatch, apiPost } from "@shared/api/request";
import type { PagedResponse } from "@shared/api/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AddReaction, CreateComment, SendCodeBody } from "../model/types";
import { commentKeys } from "./keys";
import {
	captureCommentReaction,
	reactionQueryMatches,
	updateCommentReactions,
} from "./reaction-cache";

/**
 * 回复提交后直接更新所属顶层线程的缓存，不重拉顶层列表，保持批注角标稳定。
 * 待审核回复立即对提交者显示，其他访问者仍遵循服务端审核可见性。
 */
export const useCreateComment = (postId: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateComment) => apiPost<Comment>(`/posts/${postId}/comments`, body),
		onSuccess: (newComment, variables) => {
			try {
				if (variables.parent_id) {
					const threadRootId = newComment.thread_root_id;
					if (!threadRootId) throw new Error("回复响应缺少所属线程");
					optimisticAppendReply(qc, threadRootId, newComment);
					bumpRepliesTotalInList(qc, postId, threadRootId);
					// 失效按块懒加载的批注详情查询（面板内容刷新），不影响 summary（角标稳定）
					qc.invalidateQueries({
						predicate: (query) => {
							const key = query.queryKey;
							if (key[0] !== "comments" || key[1] !== "list" || key[2] !== postId)
								return false;
							const q = key[3] as { block_id?: string } | undefined;
							return !!q?.block_id;
						},
					});
				} else {
					invalidateListByType(qc, postId, variables.anchor ? "annotation" : "free");
					if (variables.anchor) {
						qc.invalidateQueries({ queryKey: commentKeys.annotationSummary(postId) });
					}
				}
			} catch (e) {
				console.error("乐观更新失败，降级 invalidate", e);
				invalidateListsForPost(qc, postId);
				qc.invalidateQueries({ queryKey: commentKeys.annotationSummary(postId) });
				if (variables.parent_id) {
					qc.invalidateQueries({ queryKey: commentKeys.replies() });
				}
			}
		},
	});
};

/** bumpRepliesTotalInList 手动递增顶层列表缓存中父评论的 replies_total。
 *  用 setQueriesData 直接改缓存，不触发重拉——避免批注列表 refetch 引起 relocate 重算和角标消失。
 *  评论区顶层列表是 useInfiniteQuery（{pages}），其余消费方是 useQuery（{data}），两种形态都更新。 */
function bumpRepliesTotalInList(
	qc: ReturnType<typeof useQueryClient>,
	postId: string,
	parentCommentId: string,
) {
	qc.setQueriesData(
		{
			predicate: (query) => {
				const key = query.queryKey;
				return key[0] === "comments" && key[1] === "list" && key[2] === postId;
			},
		},
		(old: unknown) => {
			if (!old || typeof old !== "object") return old;
			const bumpIn = (comments: Comment[]) =>
				comments.map((c) =>
					c.id === parentCommentId
						? { ...c, replies_total: (c.replies_total ?? 0) + 1 }
						: c,
				);
			// useInfiniteQuery 缓存：每页 data 里的父评论都要递增
			if ("pages" in old && Array.isArray(old.pages)) {
				const pages = old.pages as PagedResponse<Comment>[];
				return {
					...old,
					pages: pages.map((page) =>
						Array.isArray(page.data) ? { ...page, data: bumpIn(page.data) } : page,
					),
				};
			}
			if (!("data" in old) || !Array.isArray(old.data)) return old;
			const paged = old as PagedResponse<Comment>;
			return { ...paged, data: bumpIn(paged.data) };
		},
	);
}

/** invalidateListsForPost 失效指定文章的所有顶层评论列表缓存（free + annotation）。
 *  仅作 catch 降级使用——正常流程不再 invalidate 列表，避免批注 relocate 重算。 */
function invalidateListsForPost(qc: ReturnType<typeof useQueryClient>, postId: string) {
	qc.invalidateQueries({
		predicate: (query) => {
			const key = query.queryKey;
			return key[0] === "comments" && key[1] === "list" && key[2] === postId;
		},
	});
}

/**
 * optimisticAppendReply 把新回复追加到 useReplies 缓存末尾。
 *
 * useReplies 是 useInfiniteQuery，缓存形如 { pages: [{data, pagination}], pageParams }。
 * 在第一页 data 末尾追加新回复——按时间正序是最新的在最末，符合 ASC 语义。
 * 如果该 commentId 没有缓存（回复区未展开），不做任何操作，下次展开会从后端拉到。
 */
function optimisticAppendReply(
	qc: ReturnType<typeof useQueryClient>,
	parentCommentId: string,
	newReply: Comment,
) {
	// useReplies 的 key 形如 ["comments","replies",commentId,{sort,limit}]
	// 遍历所有匹配该 commentId 的缓存（不同 sort/page 变体），追加新回复
	qc.setQueriesData(
		{
			predicate: (query) => {
				const key = query.queryKey;
				return key[0] === "comments" && key[1] === "replies" && key[2] === parentCommentId;
			},
		},
		(old: unknown) => {
			// 防御性类型检查：infinite query 缓存结构是 { pages: [...], pageParams: [...] }
			if (
				!old ||
				typeof old !== "object" ||
				!Array.isArray((old as { pages?: unknown[] }).pages)
			) {
				return old;
			}
			const typed = old as { pages: PagedResponse<Comment>[]; pageParams: number[] };
			if (typed.pages.length === 0) return old;
			const newPages = [...typed.pages];
			const firstPage = newPages[0];
			if (!firstPage || !Array.isArray(firstPage.data)) return old;
			// 第一页 data 末尾追加（ASC 时是最新的在末尾）
			newPages[0] = {
				...firstPage,
				data: [...firstPage.data, newReply],
				pagination: {
					...firstPage.pagination,
					total: (firstPage.pagination?.total ?? 0) + 1,
				},
			};
			return { ...typed, pages: newPages };
		},
	);
}

/** invalidateListByType 失效指定 type 的顶层评论列表缓存 */
function invalidateListByType(
	qc: ReturnType<typeof useQueryClient>,
	postId: string,
	type: "free" | "annotation",
) {
	qc.invalidateQueries({
		predicate: (query) => {
			const key = query.queryKey;
			if (key[0] !== "comments" || key[1] !== "list") return false;
			if (key[2] !== postId) return false;
			const q = key[3] as { type?: string } | undefined;
			return q?.type === type;
		},
	});
}

/**
 * useSendCommentCode - 匿名评论第一步：POST /posts/{postId}/comments/code 发送邮箱验证码
 *
 * 仅匿名评论需要；登录用户不调用。后端挂 CommentCodeRateLimit（5/min/IP 防邮件轰炸）。
 * 验证码一次性、TTL 10min、5 次错误锁定。
 */
export const useSendCommentCode = (postId: string) => {
	return useMutation({
		mutationFn: (body: SendCodeBody) => apiPost<null>(`/posts/${postId}/comments/code`, body),
	});
};

/**
 * 添加回应时立即更新计数、GIF 与本人名单；刷新完成前维持 pending，避免重复提交。
 */
export const useAddReaction = (commentId: string) => {
	const qc = useQueryClient();
	const me = useMe();
	const filters = {
		predicate: (query: { queryKey: readonly unknown[] }) =>
			reactionQueryMatches(query.queryKey, commentId),
	};
	return useMutation({
		mutationFn: (body: AddReaction) => apiPost<null>(`/comments/${commentId}/reactions`, body),
		onMutate: async (body) => {
			const user = me.data;
			if (!user) {
				return;
			}
			await qc.cancelQueries(filters);
			const rollback = captureCommentReaction(qc, commentId, body.emoji_id);
			const emoji = findCachedEmoji(qc, body.emoji_id);
			updateCommentReactions(qc, commentId, (reactions) =>
				addSelfReaction(
					reactions,
					body.emoji_id,
					{ id: user.id, name: user.display_name || user.username },
					emoji,
				),
			);
			return { rollback };
		},
		onError: (_error, _body, context) => {
			context?.rollback();
			toast.error("回应没有成功");
		},
		onSettled: () => qc.invalidateQueries(filters),
	});
};

/** 取消回应同时移除本人名单；失败只恢复该评论的目标表情。 */
export const useRemoveReaction = (commentId: string) => {
	const qc = useQueryClient();
	const me = useMe();
	const filters = {
		predicate: (query: { queryKey: readonly unknown[] }) =>
			reactionQueryMatches(query.queryKey, commentId),
	};
	return useMutation({
		mutationFn: (emojiId: number) =>
			apiDelete<null>(`/comments/${commentId}/reactions/${emojiId}`),
		onMutate: async (emojiId) => {
			const user = me.data;
			if (!user) {
				return;
			}
			await qc.cancelQueries(filters);
			const rollback = captureCommentReaction(qc, commentId, emojiId);
			updateCommentReactions(qc, commentId, (reactions) =>
				removeSelfReaction(reactions, emojiId, user.id),
			);
			return { rollback };
		},
		onError: (_error, _emojiId, context) => {
			context?.rollback();
			toast.error("回应没有成功");
		},
		onSettled: () => qc.invalidateQueries(filters),
	});
};

/** useApproveComment - PATCH /comments/{id}/approve 审核通过，公共端点需管理员身份 */
export const useApproveComment = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => apiPatch<null>(`/comments/${id}/approve`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: commentKeys.lists() });
		},
	});
};

/** useMarkCommentSpam - PATCH /comments/{id}/spam 标垃圾，公共端点需管理员身份 */
export const useMarkCommentSpam = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => apiPatch<null>(`/comments/${id}/spam`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: commentKeys.lists() });
		},
	});
};

/** useDeleteComment - DELETE /comments/{id} 删除，公共端点需管理员身份 */
export const useDeleteComment = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => apiDelete<null>(`/comments/${id}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: commentKeys.lists() });
		},
	});
};
