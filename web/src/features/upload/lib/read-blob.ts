/** 读取文件内容，取消时中止浏览器读取并释放监听器。 */
export function readBlob(blob: Blob, signal?: AbortSignal): Promise<ArrayBuffer> {
	signal?.throwIfAborted();
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		const cleanup = () => signal?.removeEventListener("abort", abort);
		const abort = () => {
			reader.abort();
			cleanup();
			reject(signal?.reason ?? new DOMException("上传已取消", "AbortError"));
		};
		reader.onload = () => {
			cleanup();
			if (reader.result instanceof ArrayBuffer) resolve(reader.result);
			else reject(new Error("无法读取文件内容"));
		};
		reader.onerror = () => {
			cleanup();
			reject(reader.error ?? new Error("无法读取文件内容"));
		};
		signal?.addEventListener("abort", abort, { once: true });
		reader.readAsArrayBuffer(blob);
	});
}
