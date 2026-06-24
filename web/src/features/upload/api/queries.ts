import { httpClient } from "@shared/api/http";

export interface InitSessionResult {
	instant: boolean;
	file_id?: string;
	url?: string;
	upload_id?: string;
	chunk_size: number;
	total_chunks: number;
	uploaded_chunks: number[];
}

export interface MergeResult {
	file_id: string;
	url: string;
	thumbnail?: string;
	width?: number;
	height?: number;
}

/**
 * initUpload - 初始化上传会话(秒传/续传/新建)
 *
 * 头像场景按单分片处理:chunkSize = fileSize, totalChunks = 1,
 * 省去多分片并发复杂度。
 */
export async function initUpload(opts: {
	fileName: string;
	fileSize: number;
	fileHash: string;
	mimeType: string;
	purpose: string;
}): Promise<InitSessionResult> {
	const res = await httpClient.post<{ data: InitSessionResult }>(
		"/upload/init",
		{
			fileName: opts.fileName,
			fileSize: opts.fileSize,
			fileHash: opts.fileHash,
			mimeType: opts.mimeType,
			chunkSize: opts.fileSize, // 单分片:整文件作为一个 chunk
			purpose: opts.purpose,
		},
	);
	return res.data.data;
}

/** uploadChunk - 上传单个分片(raw body,非 multipart) */
export async function uploadChunk(
	uploadId: string,
	index: number,
	data: ArrayBuffer,
): Promise<void> {
	await httpClient.put(`/upload/${uploadId}/chunk/${index}`, data, {
		headers: { "Content-Type": "application/octet-stream" },
	});
}

/** completeUpload - 合并所有分片,返回最终文件信息 */
export async function completeUpload(uploadId: string): Promise<MergeResult> {
	const res = await httpClient.post<{ data: MergeResult }>(
		`/upload/${uploadId}/complete`,
	);
	return res.data.data;
}
