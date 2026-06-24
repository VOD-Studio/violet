import { apiDelete, apiPatch, apiPost } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
	AddReaction,
	BatchUpdateCommentStatus,
	BatchUpdateStatusResponse,
	CreateComment,
} from "../model/types";
import { commentKeys } from "./keys";

/**
 * useCreateComment - 调后端 POST /posts/{postId}/comments 提交评论
 *
 * 新评论默认 pending 状态，需审核后才在前台展示。
 * 成功后失效该文章评论列表缓存。
 *
 * @param postId 文章 ID
 */
export const useCreateComment = (postId: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateComment) => apiPost<null>(`/posts/${postId}/comments`, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: commentKeys.lists() });
		},
	});
};

/**
 * useAddReaction - 调后端 POST /comments/{commentId}/reactions 添加评论反应
 *
 * 后端按用户或 IP 幂等去重，重复添加会被忽略。
 * 成功后失效该评论的反应列表缓存。
 *
 * @param commentId 评论 ID
 */
export const useAddReaction = (commentId: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: AddReaction) => apiPost<null>(`/comments/${commentId}/reactions`, body),
		onSuccess: () => {
			qc.invalidateQueries({
				queryKey: commentKeys.reactionList(commentId),
			});
		},
	});
};

/**
 * useRemoveReaction - 调后端 DELETE /comments/{commentId}/reactions/{emojiId} 移除评论反应
 *
 * path param 分别为 comment_id 与 emoji_id，严格按后端命名。
 * 成功后失效该评论的反应列表缓存。
 *
 * @param commentId 评论 ID
 */
export const useRemoveReaction = (commentId: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (emojiId: number) => apiDelete<null>(`/comments/${commentId}/reactions/${emojiId}`),
		onSuccess: () => {
			qc.invalidateQueries({
				queryKey: commentKeys.reactionList(commentId),
			});
		},
	});
};

/**
 * useApproveComment - 调后端 PATCH /comments/{id}/approve 审核通过评论
 *
 * 需管理员身份。成功后失效后台评论相关缓存。
 *
 * @param id 评论 ID
 */
export const useApproveComment = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => apiPatch<null>(`/comments/${id}/approve`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: commentKeys.admin() });
		},
	});
};

/**
 * useMarkCommentSpam - 调后端 PATCH /comments/{id}/spam 标记评论为垃圾
 *
 * 需管理员身份。成功后失效后台评论相关缓存。
 *
 * @param id 评论 ID
 */
export const useMarkCommentSpam = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => apiPatch<null>(`/comments/${id}/spam`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: commentKeys.admin() });
		},
	});
};

/**
 * useDeleteComment - 调后端 DELETE /comments/{id} 删除评论
 *
 * 需管理员身份。成功后失效后台评论相关缓存。
 *
 * @param id 评论 ID
 */
export const useDeleteComment = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => apiDelete<null>(`/comments/${id}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: commentKeys.admin() });
		},
	});
};

/**
 * useBatchUpdateCommentStatus - 调后端 PATCH /admin/comments/batch-status 批量更新评论状态
 *
 * 需管理员身份。成功后失效后台评论列表与待审核数量缓存。
 */
export const useBatchUpdateCommentStatus = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: BatchUpdateCommentStatus) =>
			apiPatch<BatchUpdateStatusResponse>("/admin/comments/batch-status", body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: commentKeys.adminLists() });
			qc.invalidateQueries({ queryKey: commentKeys.pending() });
		},
	});
};
