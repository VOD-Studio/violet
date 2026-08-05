import type { MediaFile } from "@entities/media/model/types";
import { apiDelete, apiPatch, apiPost } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateMediaRequest } from "../model/types";
import { adminMediaKeys } from "./keys";

/**
 * useAdminDeleteFile - admin 删除素材 mutation
 *
 * 对接 DELETE /admin/media/{id}，需 media:delete 权限。
 * 成功后失效后台素材列表。
 */
export const useAdminDeleteFile = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => apiDelete<null>(`/admin/media/${id}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: adminMediaKeys.lists() });
		},
	});
};

/**
 * useBatchDeleteMedia - admin 批量删除素材 mutation
 *
 * 对接 POST /admin/media/batch-delete，需 media:delete 权限。
 * 成功后失效后台素材列表并清空选中态（由调用方处理）。
 */
export const useBatchDeleteMedia = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (ids: string[]) =>
			apiPost<{ deleted: number }>("/admin/media/batch-delete", { ids }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: adminMediaKeys.lists() });
		},
	});
};

/**
 * useUpdateMediaMetadata - 更新素材元数据 mutation
 *
 * 对接 PATCH /admin/media/{id}，需 media:upload 权限。
 * 更新 alt_text/category/original_name，成功后失效列表。
 */
export const useUpdateMediaMetadata = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateMediaRequest }) =>
			apiPatch<MediaFile>(`/admin/media/${id}`, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: adminMediaKeys.lists() });
		},
	});
};
