/**
 * useChunkedUpload - 通用分片上传 hook
 *
 * 封装完整的分片上传流程：SHA-256 秒传检查 → 断点续传 → 分片上传 → 合并。
 * 支持进度回调，供通用 Uploader 及各业务场景（头像/表情/素材）复用。
 *
 * 复用 upload 模块的裸请求函数（initUpload/uploadChunk/completeUpload），
 * 不重复定义 API。不依赖 React Query，调用方自行决定如何 invalidate 缓存。
 *
 * 设计要点：
 * - 小文件（< chunkSize）走单分片，避免无谓开销
 * - 秒传命中直接返回，不传任何分片
 * - 断点续传：跳过已上传的分片索引
 * - 进度回调按已传字节 / 总字节计算百分比
 */

import { useCallback } from "react";
import { completeUpload, initUpload, uploadChunk } from "@/features/upload/api/mutations";
import { sha256 } from "@/features/upload/lib/sha256";
import type { CompleteUploadResult } from "@/features/upload/model/types";

/** 默认分片大小 5MB（与后端一致） */
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;

/** 单分片上限 32MB（后端 MaxBytesReader 限制） */
const MAX_CHUNK_SIZE = 32 * 1024 * 1024;

export interface UseChunkedUploadOptions {
    /** 用途分类，默认 material */
    purpose?: string;
    /** 分片大小，默认 5MB，自动夹取到 [1MB, 32MB] */
    chunkSize?: number;
}

export interface UploadProgress {
    /** 已上传字节 */
    uploaded: number;
    /** 总字节 */
    total: number;
    /** 百分比 0-100 */
    percent: number;
}

export interface UseChunkedUploadResult {
    /**
     * 上传单个文件
     *
     * @param file 文件对象
     * @param onProgress 进度回调（每个分片完成后触发）
     * @returns 合并结果（含 file_id 与 url）
     */
    uploadFile: (
        file: File,
        onProgress?: (progress: UploadProgress) => void,
    ) => Promise<CompleteUploadResult>;
}

/**
 * useChunkedUpload - 通用分片上传 hook
 *
 * @example
 * const { uploadFile } = useChunkedUpload({ purpose: "material" });
 * const result = await uploadFile(file, (p) => setProgress(p.percent));
 */
export function useChunkedUpload(options: UseChunkedUploadOptions = {}): UseChunkedUploadResult {
    const purpose = options.purpose ?? "material";
    // 夹取分片大小到合理范围
    const chunkSize = Math.min(
        MAX_CHUNK_SIZE,
        Math.max(1024 * 1024, options.chunkSize ?? DEFAULT_CHUNK_SIZE),
    );

    const uploadFile = useCallback(
        async (
            file: File,
            onProgress?: (progress: UploadProgress) => void,
        ): Promise<CompleteUploadResult> => {
            const report = (uploaded: number) =>
                onProgress?.({
                    uploaded,
                    total: file.size,
                    percent: file.size === 0 ? 100 : Math.round((uploaded / file.size) * 100),
                });

            // 1. 算 SHA-256（用于秒传/断点续传检查）
            const fileHash = await sha256(file);

            // 2. 初始化会话
            const init = await initUpload({
                fileName: file.name,
                fileSize: file.size,
                fileHash,
                mimeType: file.type || undefined,
                chunkSize,
                purpose,
            });

            // 3. 秒传命中：直接返回
            if (init.instant) {
                report(file.size);
                return {
                    file_id: init.file_id ?? "",
                    url: init.url ?? "",
                };
            }

            // 4. 未命中：上传分片（跳过已上传的）
            if (!init.upload_id) {
                throw new Error("上传初始化失败：未返回会话 ID");
            }
            const uploadedSet = new Set(init.uploaded_chunks ?? []);
            const totalChunks = init.total_chunks;
            let uploadedBytes = 0;
            for (let i = 0; i < totalChunks; i++) {
                if (uploadedSet.has(i)) {
                    // 续传：该分片已上传，累计字节数
                    uploadedBytes += getChunkSize(file.size, chunkSize, i);
                    continue;
                }
                const chunkData = await readChunk(file, i, chunkSize);
                await uploadChunk(init.upload_id, i, chunkData);
                uploadedBytes += chunkData.byteLength;
                report(uploadedBytes);
            }

            // 5. 合并
            const result = await completeUpload(init.upload_id);
            report(file.size);
            return result;
        },
        [purpose, chunkSize],
    );

    return { uploadFile };
}

/**
 * 读取文件的指定分片
 */
async function readChunk(file: File, index: number, chunkSize: number): Promise<ArrayBuffer> {
    const start = index * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    return file.slice(start, end).arrayBuffer();
}

/**
 * 计算指定分片的字节大小（用于续传时累计进度）
 */
function getChunkSize(fileSize: number, chunkSize: number, index: number): number {
    const start = index * chunkSize;
    const end = Math.min(start + chunkSize, fileSize);
    return Math.max(0, end - start);
}
