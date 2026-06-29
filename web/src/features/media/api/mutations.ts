/**
 * media 模块 mutations - 媒体资源 CRUD
 *
 * 仅包含媒体资源管理操作（删除/批量删除/缩略图/admin 删除）。
 * 上传能力（init/chunk/complete）已统一归到 upload 模块，
 * 本模块不重复定义，需要上传时 import features/upload。
 */
import { apiDelete, apiPatch, apiPost } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
    BatchDeleteRequest,
    BatchDeleteResult,
    MediaFile,
    ThumbnailUploadResult,
    UpdateMediaRequest,
} from "../model/types";
import { adminFileKeys, mediaKeys } from "./keys";

/**
 * useDeleteMedia - 删除单个媒体 mutation
 *
 * 对接 DELETE /media/{id}，后端返回消息信封 data 为 null。
 * 成功后 invalidate 媒体列表与 admin 文件列表。
 *
 * @param id 媒体 ID
 */
export const useDeleteMedia = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => apiDelete<null>(`/media/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: mediaKeys.lists() });
            queryClient.invalidateQueries({
                queryKey: adminFileKeys.lists(),
            });
        },
    });
};

/**
 * useBatchDeleteMedia - 批量删除媒体 mutation
 *
 * 对接 POST /media/batch-delete，返回实际删除条数。
 * 被引用未删的文件不计入 deleted。成功后 invalidate 两个列表维度。
 */
export const useBatchDeleteMedia = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: BatchDeleteRequest) =>
            apiPost<BatchDeleteResult>("/media/batch-delete", body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: mediaKeys.lists() });
            queryClient.invalidateQueries({
                queryKey: adminFileKeys.lists(),
            });
        },
    });
};

/**
 * uploadThumbnail - 上传缩略图底层请求函数
 *
 * 对接 POST /media/{id}/thumbnail，multipart/form-data，字段名固定为 file。
 *
 * @param id 媒体 ID
 * @param file 缩略图文件
 */
export const uploadThumbnail = async (id: string, file: File): Promise<ThumbnailUploadResult> => {
    const form = new FormData();
    form.append("file", file);
    return apiPost<ThumbnailUploadResult>(`/media/${id}/thumbnail`, form);
};

/**
 * useUploadThumbnail - 上传缩略图 mutation
 *
 * 成功后 invalidate 对应媒体详情与列表，使缩略图 URL 刷新。
 */
export const useUploadThumbnail = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, file }: { id: string; file: File }) => uploadThumbnail(id, file),
        onSuccess: (_data, { id }) => {
            queryClient.invalidateQueries({
                queryKey: mediaKeys.detail(id),
            });
            queryClient.invalidateQueries({ queryKey: mediaKeys.lists() });
            // admin 素材管理页用 adminFileKeys，必须一并 invalidate 才会刷新
            queryClient.invalidateQueries({ queryKey: adminFileKeys.lists() });
        },
    });
};

// ============================================================
// admin 文件管理
// ============================================================

/**
 * useAdminDeleteFile - admin 删除素材 mutation
 *
 * 对接 DELETE /admin/media/{id}，需 media:delete 权限。
 * 成功后 invalidate admin 素材列表与媒体列表。
 */
export const useAdminDeleteFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => apiDelete<null>(`/admin/media/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: adminFileKeys.lists(),
            });
            queryClient.invalidateQueries({ queryKey: mediaKeys.lists() });
        },
    });
};

/**
 * useUpdateMediaMetadata - 更新素材元数据 mutation
 *
 * 对接 PATCH /admin/media/{id}，需 media:upload 权限。
 * 更新 alt_text/category/original_name，成功后 invalidate 列表。
 */
export const useUpdateMediaMetadata = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateMediaRequest }) =>
            apiPatch<MediaFile>(`/admin/media/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: adminFileKeys.lists(),
            });
            queryClient.invalidateQueries({ queryKey: mediaKeys.lists() });
        },
    });
};
