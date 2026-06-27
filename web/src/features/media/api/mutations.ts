import { apiDelete, apiPost, apiPut } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
    BatchDeleteRequest,
    BatchDeleteResult,
    CompleteUploadResult,
    InitUploadRequest,
    InitUploadResult,
    ThumbnailUploadResult,
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
        },
    });
};

// ============================================================
// 分片上传
// ============================================================

/**
 * useInitUpload - 初始化上传会话 mutation
 *
 * 对接 POST /upload/init。后端按 fileHash 判断秒传或续传，
 * instant=true 时可直接复用返回的 url，无需再传分片。
 */
export const useInitUpload = () =>
    useMutation({
        mutationFn: (body: InitUploadRequest) => apiPost<InitUploadResult>("/upload/init", body),
    });

/**
 * uploadChunk - 上传单个分片底层请求函数
 *
 * 对接 PUT /upload/{uploadId}/chunk/{index}。
 * 后端 handler 用 io.ReadAll 读取 raw body 作为分片二进制，
 * 非 multipart，故 Content-Type 设 application/octet-stream 透传 ArrayBuffer。
 *
 * @param uploadId 上传会话 ID
 * @param index 分片索引，从 0 开始
 * @param data 分片二进制内容
 */
export const uploadChunk = async (
    uploadId: string,
    index: number,
    data: ArrayBuffer,
): Promise<null> =>
    apiPut<null>(`/upload/${uploadId}/chunk/${index}`, data, {
        headers: { "Content-Type": "application/octet-stream" },
    });

/**
 * useUploadChunk - 上传单个分片 mutation
 *
 * 不自动 invalidate，分片级缓存由 UI 层进度状态管理。
 */
export const useUploadChunk = () =>
    useMutation({
        mutationFn: ({
            uploadId,
            index,
            data,
        }: {
            uploadId: string;
            index: number;
            data: ArrayBuffer;
        }) => uploadChunk(uploadId, index, data),
    });

/**
 * useCompleteUpload - 合并分片 mutation
 *
 * 对接 POST /upload/{uploadId}/complete。后端合并分片并生成缩略图，
 * 返回最终 file_id 与 url。成功后 invalidate 媒体列表使新文件可见。
 */
export const useCompleteUpload = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (uploadId: string) =>
            apiPost<CompleteUploadResult>(`/upload/${uploadId}/complete`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: mediaKeys.lists() });
            queryClient.invalidateQueries({
                queryKey: adminFileKeys.lists(),
            });
        },
    });
};

/**
 * useCancelUpload - 取消上传 mutation
 *
 * 对接 DELETE /upload/{uploadId}，后端清理临时分片并删除会话。
 * 返回消息信封 data 为 null。
 */
export const useCancelUpload = () =>
    useMutation({
        mutationFn: (uploadId: string) => apiDelete<null>(`/upload/${uploadId}`),
    });

// ============================================================
// admin 文件管理
// ============================================================

/**
 * useAdminDeleteFile - admin 删除文件 mutation
 *
 * 对接 DELETE /admin/files/{id}，与 /media/{id} 复用 handler。
 * 成功后 invalidate admin 文件列表与媒体列表。
 */
export const useAdminDeleteFile = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => apiDelete<null>(`/admin/files/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: adminFileKeys.lists(),
            });
            queryClient.invalidateQueries({ queryKey: mediaKeys.lists() });
        },
    });
};
