import { readBlob } from "@features/upload/lib/read-blob";

/**
 * 计算文件 SHA-256(浏览器原生 crypto.subtle,零依赖)。
 * 用于上传前的秒传检查。
 */
export async function sha256(file: File, signal?: AbortSignal): Promise<string> {
	const buffer = await readBlob(file, signal);
	signal?.throwIfAborted();
	const digest = await crypto.subtle.digest("SHA-256", buffer);
	signal?.throwIfAborted();
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
