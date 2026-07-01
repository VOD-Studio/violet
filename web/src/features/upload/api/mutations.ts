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
    ThumbnailUploadResult,
} from "../model/types";

/**
 * initUpload - 初始化上传会话
 *
 * 调后端 POST /upload/init，按 fileHash 判断秒传或续传。
 *
 * @param opts 文件元信息与用途
 * @returns 秒传命中时带 url，否则带 upload_id 供后续分片上传
 */
export const initUpload = (opts: InitUploadRequest): Promise<InitUploadResult> =>
    apiPost<InitUploadResult>("/upload/init", opts);

/**
 * uploadChunk - 上传单个分片
 *
 * 调后端 PUT /upload/{uploadId}/chunk/{index}，原始二进制 body。
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
    await apiPut<null>(`/upload/${uploadId}/chunk/${index}`, data, {
        headers: { "Content-Type": "application/octet-stream" },
    });
};

/**
 * completeUpload - 合并所有分片完成上传
 *
 * 调后端 POST /upload/{uploadId}/complete，后端合并分片并生成缩略图。
 *
 * @param uploadId 上传会话 ID
 * @returns 最终文件 ID 与访问 URL
 */
export const completeUpload = (uploadId: string): Promise<CompleteUploadResult> =>
    apiPost<CompleteUploadResult>(`/upload/${uploadId}/complete`);

/**
 * cancelUpload - 取消上传，清理临时分片
 *
 * 调后端 DELETE /upload/{uploadId}，后端清理临时分片并删除会话。
 */
export const cancelUpload = (uploadId: string): Promise<void> => {
    return apiDelete<null>(`/upload/${uploadId}`).then(() => undefined);
};

/**
 * getUploadStatus - 查询上传会话状态（断点续传）
 *
 * 调后端 GET /upload/{uploadId}/status。
 */
export const getUploadStatus = (uploadId: string): Promise<InitUploadResult> =>
    apiGet<InitUploadResult>(`/upload/${uploadId}/status`);

/**
 * uploadThumbnail - 上传缩略图底层请求函数
 *
 * 对接 POST /media/{id}/thumbnail，multipart/form-data，字段名固定为 file。
 * 上传成功后的缓存失效由调用方按所属 slice 的 key 自行处理。
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
 * 不内置 invalidate：缩略图关联的列表 key 属消费方 slice（media/admin-media），
 * 由调用方在 onSuccess 自行失效。
 */
export const useUploadThumbnail = () =>
    useMutation({
        mutationFn: ({ id, file }: { id: string; file: File }) => uploadThumbnail(id, file),
    });
