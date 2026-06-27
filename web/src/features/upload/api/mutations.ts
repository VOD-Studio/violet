import { apiPost, apiPut } from "@shared/api/request";
import type { InitSessionResult, InitUploadRequest, MergeResult } from "../model/types";

/**
 * initUpload - 初始化上传会话
 *
 * 调后端 POST /upload/init，按 fileHash 判断秒传或续传。
 * 头像场景按单分片处理，chunkSize 取 fileSize，省去多分片并发。
 *
 * @param opts 文件元信息与用途
 * @returns 秒传命中时带 url，否则带 upload_id 供后续分片上传
 */
export const initUpload = (opts: InitUploadRequest): Promise<InitSessionResult> =>
    apiPost<InitSessionResult>("/upload/init", opts);

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
export const completeUpload = (uploadId: string): Promise<MergeResult> =>
    apiPost<MergeResult>(`/upload/${uploadId}/complete`);
