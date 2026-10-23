import {
	cancelUpload,
	completeUpload,
	getUploadStatus,
	initUpload,
	uploadChunk,
} from "@features/upload/api/mutations";
import { readBlob } from "@features/upload/lib/read-blob";
import { sha256 } from "@features/upload/lib/sha256";
import type { CompleteUploadResult, InitUploadResult } from "@features/upload/model/types";
import { useCallback, useRef } from "react";

/** 分片上传用途与首次初始化的建议分片大小。 */
export interface UseChunkedUploadOptions {
	purpose?: string;
	chunkSize?: number;
}

/** 已确认上传的字节进度。 */
export interface UploadProgress {
	uploaded: number;
	total: number;
	percent: number;
}

/** 单文件上传入口，重试复用同一文件的会话标识。 */
export interface UseChunkedUploadResult {
	uploadFile: (
		file: File,
		onProgress?: (progress: UploadProgress) => void,
		signal?: AbortSignal,
	) => Promise<CompleteUploadResult>;
}

interface FileSession {
	id: string;
	hash?: string;
	/** 请求可能已落库，响应丢失后取消仍需清理稳定 ID。 */
	initialized: boolean;
	/** 已确认的会话恢复时只读状态，不重复消耗初始化写额度。 */
	confirmed: boolean;
}

/** 哈希检查、服务端分片续传与合并；取消以服务端确认结果为准。 */
export function useChunkedUpload(options: UseChunkedUploadOptions = {}): UseChunkedUploadResult {
	const purpose = options.purpose ?? "material";
	const chunkSize = Math.min(
		32 * 1024 * 1024,
		Math.max(1024 * 1024, options.chunkSize ?? 5 * 1024 * 1024),
	);
	const sessions = useRef(new WeakMap<File, FileSession>());
	const uploadFile = useCallback(
		async (
			file: File,
			onProgress?: (progress: UploadProgress) => void,
			signal?: AbortSignal,
		): Promise<CompleteUploadResult> => {
			let session = sessions.current.get(file);
			if (!session) {
				session = { id: crypto.randomUUID(), initialized: false, confirmed: false };
				sessions.current.set(file, session);
			}
			const report = (uploaded: number) =>
				onProgress?.({
					uploaded,
					total: file.size,
					percent: file.size === 0 ? 100 : Math.round((uploaded / file.size) * 100),
				});
			try {
				signal?.throwIfAborted();
				session.hash ??= await sha256(file, signal);
				signal?.throwIfAborted();
				let init: InitUploadResult;
				if (session.confirmed) {
					init = await getUploadStatus(session.id, signal);
				} else {
					session.initialized = true;
					init = await initUpload(
						{
							fileName: file.name,
							fileSize: file.size,
							fileHash: session.hash,
							mimeType: file.type || undefined,
							chunkSize,
							purpose,
							clientUploadId: session.id,
						},
						signal,
					);
				}
				if (init.instant) {
					if (!init.file_id || !init.url) throw new Error("上传初始化缺少已完成文件信息");
					report(file.size);
					return { file_id: init.file_id, url: init.url };
				}
				if (!init.upload_id) throw new Error("上传初始化未返回会话 ID");
				session.id = init.upload_id;
				if (
					!Number.isInteger(init.chunk_size) ||
					init.chunk_size <= 0 ||
					init.total_chunks !== Math.ceil(file.size / init.chunk_size)
				) {
					throw new Error("服务端返回的分片参数无效");
				}
				session.confirmed = true;
				const uploaded = new Set(init.uploaded_chunks ?? []);
				let uploadedBytes = 0;
				for (let index = 0; index < init.total_chunks; index++) {
					if (uploaded.has(index))
						uploadedBytes += Math.min(
							init.chunk_size,
							file.size - index * init.chunk_size,
						);
				}
				report(uploadedBytes);
				for (let index = 0; index < init.total_chunks; index++) {
					signal?.throwIfAborted();
					if (uploaded.has(index)) continue;
					const start = index * init.chunk_size;
					const data = await readBlob(
						file.slice(start, Math.min(start + init.chunk_size, file.size)),
						signal,
					);
					await uploadChunk(init.upload_id, index, data, signal);
					uploadedBytes += data.byteLength;
					report(uploadedBytes);
				}
				const result = await completeUpload(init.upload_id, signal);
				report(file.size);
				return result;
			} catch (error) {
				if (!signal?.aborted) throw error;
				if (session.initialized) {
					const cancelled = await cancelUpload(session.id);
					if (cancelled.completed) {
						if (!cancelled.file)
							throw new Error("服务端已合并，但未返回文件信息，请刷新素材列表");
						report(file.size);
						return cancelled.file;
					}
				}
				sessions.current.delete(file);
				throw new DOMException("上传已取消", "AbortError");
			}
		},
		[purpose, chunkSize],
	);
	return { uploadFile };
}
