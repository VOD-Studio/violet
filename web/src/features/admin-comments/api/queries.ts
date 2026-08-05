import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { BatchUpdateCommentsRequest, CommentListQuery } from "../model/types";
import * as api from "./client";
import { commentKeys } from "./keys";

/** useAllComments - 全部评论列表 hook（按状态筛选，服务端分页） */
export const useAllComments = (query: CommentListQuery = {}) =>
	useQuery({
		queryKey: commentKeys.list(query),
		queryFn: () => api.listAllComments(query),
	});

/** usePendingCommentCount - 待审核评论数量 hook（徽标用） */
export const usePendingCommentCount = () =>
	useQuery({
		queryKey: commentKeys.pendingCount(),
		queryFn: () => api.countPendingComments(),
	});

/** 评论变更后失效全部列表 + 待审核计数 */
const useInvalidateComments = () => {
	const qc = useQueryClient();
	return () => {
		qc.invalidateQueries({ queryKey: commentKeys.lists() });
		qc.invalidateQueries({ queryKey: commentKeys.pending() });
		qc.invalidateQueries({ queryKey: commentKeys.pendingCount() });
	};
};

/** useApproveComment - 审核通过单条评论 */
export const useApproveComment = () => {
	const invalidate = useInvalidateComments();
	return useMutation({
		mutationFn: (id: string) => api.approveComment(id),
		onSuccess: () => {
			invalidate();
			toast.success("评论已通过");
		},
		onError: (e: Error) => toast.error(`审核失败：${e.message}`),
	});
};

/** useMarkCommentSpam - 标记单条评论为垃圾 */
export const useMarkCommentSpam = () => {
	const invalidate = useInvalidateComments();
	return useMutation({
		mutationFn: (id: string) => api.markCommentSpam(id),
		onSuccess: () => {
			invalidate();
			toast.success("已标记为垃圾");
		},
		onError: (e: Error) => toast.error(`操作失败：${e.message}`),
	});
};

/** useDeleteComment - 删除单条评论 */
export const useDeleteComment = () => {
	const invalidate = useInvalidateComments();
	return useMutation({
		mutationFn: (id: string) => api.deleteComment(id),
		onSuccess: () => {
			invalidate();
			toast.success("评论已删除");
		},
		onError: (e: Error) => toast.error(`删除失败：${e.message}`),
	});
};

/** useBatchUpdateComments - 批量更新评论状态 */
export const useBatchUpdateComments = () => {
	const invalidate = useInvalidateComments();
	return useMutation({
		mutationFn: (body: BatchUpdateCommentsRequest) => api.batchUpdateComments(body),
		onSuccess: (res) => {
			invalidate();
			toast.success(`已更新 ${res.affected} 条评论`);
		},
		onError: (e: Error) => toast.error(`批量操作失败：${e.message}`),
	});
};
