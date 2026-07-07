/**
 * upload 模块 API - 分片上传裸请求函数
 *
 * 项目级「上传能力」的底层封装，不依赖 React Query。
 * 通用分片上传流程（秒传/续传/进度）由 useChunkedUpload hook 编排，
 * 业务侧（头像/表情/素材）直接复用本模块的裸函数或 hook。
 */
import { apiDelete, apiGet, apiPost, apiPut } from "@shared/api/request";
import { useMutation } from "@tanstack/react-query";
import type {
    CompleteUploadResult,
    InitUploadRequest,
    InitUploadResult,
    ReplaceMediaResult,
    ThumbnailUploadResult,
} from "../model/types";

/**
 * initUpload - 初始化上传会话
 *
 * 调后端 POST /uploads，按 fileHash 判断秒传或续传。
 *
 * @param opts 文件元信息与用途
 * @returns 秒传命中时带 url，否则带 upload_id 供后续分片上传
 */
export const initUpload = (opts: InitUploadRequest): Promise<InitUploadResult> =>
    apiPost<InitUploadResult>("/uploads", opts);

/**
 * uploadChunk - 上传单个分片
 *
 * 调后端 PUT /uploads/{uploadId}/chunks/{index}，原始二进制 body。
 * 后端用 io.ReadAll 读取 raw body，故 Content-Type 设 application/octet-stream。
 *
 * @param uploadId 上传会话 ID
 * @param index 分片索引，从 0 开始
 * @param data 分片二进制内容
 */
export const uploadChunk = async (
    uploadId: string,
    index: number,
    data: ArrayBuffer,
): Promise<void> => {
    await apiPut<null>(`/uploads/${uploadId}/chunks/${index}`, data, {
        headers: { "Content-Type": "application/octet-stream" },
    });
};

/**
 * completeUpload - 合并所有分片完成上传
 *
 * 调后端 POST /uploads/{uploadId}/complete，后端合并分片并生成缩略图。
 *
 * @param uploadId 上传会话 ID
 * @returns 最终文件 ID 与访问 URL
 */
export const completeUpload = (uploadId: string): Promise<CompleteUploadResult> =>
    apiPost<CompleteUploadResult>(`/uploads/${uploadId}/complete`);

/**
 * cancelUpload - 取消上传，清理临时分片
 *
 * 调后端 DELETE /uploads/{uploadId}，后端清理临时分片并删除会话。
 */
export const cancelUpload = (uploadId: string): Promise<void> => {
    return apiDelete<null>(`/uploads/${uploadId}`).then(() => undefined);
};

/**
 * getUploadStatus - 查询上传会话状态（断点续传）
 *
 * 调后端 GET /uploads/{uploadId}。
 */
export const getUploadStatus = (uploadId: string): Promise<InitUploadResult> =>
    apiGet<InitUploadResult>(`/uploads/${uploadId}`);

/**
 * uploadThumbnail - 上传缩略图底层请求函数
 *
 * 对接 POST /uploads/thumbnail，multipart/form-data，
 * 字段：file（缩略图）+ fileId（所属媒体 ID）。
 * 上传成功后的缓存失效由调用方按所属 slice 的 key 自行处理。
 *
 * @param id 媒体 ID
 * @param file 缩略图文件
 */
export const uploadThumbnail = async (id: string, file: File): Promise<ThumbnailUploadResult> => {
    const form = new FormData();
    form.append("file", file);
    form.append("fileId", id);
    return apiPost<ThumbnailUploadResult>("/uploads/thumbnail", form);
};

/**
 * useUploadThumbnail - 上传缩略图 mutation
 *
 * 不内置 invalidate：缩略图关联的列表 key 属消费方 slice（media/admin-media），
 * 由调用方在 onSuccess 自行失效。
 */
export const useUploadThumbnail = () =>
    useMutation({
        mutationFn: ({ id, file }: { id: string; file: File }) => uploadThumbnail(id, file),
    });

/**
 * replaceMediaFile - 覆盖素材原图底层请求函数
 *
 * 对接 POST /uploads/replace，multipart/form-data，
 * 字段：file（裁剪后新文件）+ fileId（目标素材 ID）。
 * 仅 owner 可覆盖自己上传的素材，GIF 拒绝。
 */
export const replaceMediaFile = async (fileId: string, file: File): Promise<ReplaceMediaResult> => {
    const form = new FormData();
    form.append("file", file);
    form.append("fileId", fileId);
    return apiPost<ReplaceMediaResult>("/uploads/replace", form);
};

/**
 * useReplaceMediaFile - 覆盖素材原图 mutation
 *
 * 不内置 invalidate：素材列表 key 属 admin-media slice，
 * 由调用方在 onSuccess 自行失效。
 */
export const useReplaceMediaFile = () =>
    useMutation({
        mutationFn: ({ fileId, file }: { fileId: string; file: File }) =>
            replaceMediaFile(fileId, file),
    });
