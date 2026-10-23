import type { EmojiUploadResult } from "@entities/emoji/model/types";
import { uploadEmoji } from "@features/emojis/api/mutations";
import { Uploader } from "@features/upload/ui/Uploader";
import { useCallback } from "react";

interface EmojiUploaderProps {
	onUpload?: (result: EmojiUploadResult) => void;
	maxFiles?: number;
	onBusyChange?: (busy: boolean) => void;
}

/**
 * EmojiUploader - 表情上传
 *
 * 绑定表情专用上传接口，UI 与交互复用通用 Uploader。
 * 上传返回 url 后由父组件负责创建表情记录落库。
 */
export function EmojiUploader({ onUpload, maxFiles = 20, onBusyChange }: EmojiUploaderProps) {
	const upload = useCallback(
		async (file: File, _onProgress?: (percent: number) => void, signal?: AbortSignal) => {
			try {
				signal?.throwIfAborted();
				return await uploadEmoji(file, signal);
			} catch (error) {
				if (signal?.aborted) throw new DOMException("上传已取消", "AbortError");
				throw error;
			}
		},
		[],
	);

	return (
		<Uploader<EmojiUploadResult>
			upload={upload}
			onUploaded={onUpload}
			onBusyChange={onBusyChange}
			accept="image/png,image/jpeg,image/gif,image/webp"
			maxSize={10 * 1024 * 1024}
			maxFiles={maxFiles}
			label="拖拽或点击上传图片"
			hint="PNG、JPG、GIF、WebP，最大 10MB"
		/>
	);
}
