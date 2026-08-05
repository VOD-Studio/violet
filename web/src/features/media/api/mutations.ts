/**
 * media 模块 mutations - 前台素材库删除
 *
 * 仅含当前用户删除/批量删除自己素材的操作。后台管理操作见 admin-media，
 * 上传能力见 upload。
 */
import { apiDelete, apiPost } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { BatchDeleteRequest, BatchDeleteResult } from "../model/types";
import { mediaKeys } from "./keys";

/**
 * useDeleteMedia - 删除单个媒体 mutation
 *
 * 对接 DELETE /media/{id}，后端返回 data 为 null。
 * 成功后失效当前用户媒体列表。
 */
export const useDeleteMedia = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => apiDelete<null>(`/media/${id}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: mediaKeys.lists() });
		},
	});
};

/**
 * useBatchDeleteMedia - 批量删除媒体 mutation
 *
 * 对接 POST /media/batch-delete，返回实际删除条数。
 * 被引用未删的文件不计入 deleted。
 */
export const useBatchDeleteMedia = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: BatchDeleteRequest) =>
			apiPost<BatchDeleteResult>("/media/batch-delete", body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: mediaKeys.lists() });
		},
	});
};
