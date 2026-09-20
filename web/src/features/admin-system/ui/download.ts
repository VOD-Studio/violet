import type { DownloadedFile } from "../api/client";

/** 将已鉴权 API 返回的 Blob 保存为本地附件。 */
export function saveDownloadedFile(file: DownloadedFile) {
	const url = URL.createObjectURL(file.blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = file.filename;
	anchor.click();
	URL.revokeObjectURL(url);
}
