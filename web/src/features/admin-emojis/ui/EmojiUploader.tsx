import type { EmojiUploadResult } from "@entities/emoji/model/types";
import { useUploadEmoji } from "@features/admin-emojis/api/mutations";
import { Uploader } from "@shared/ui/uploader";
import { useCallback } from "react";

interface EmojiUploaderProps {
    onUpload?: (result: EmojiUploadResult) => void;
    maxFiles?: number;
}

/**
 * EmojiUploader - 表情上传
 *
 * 绑定表情专用上传接口，UI 与交互复用通用 Uploader。
 * 上传返回 url 后由父组件负责创建表情记录落库。
 */
export function EmojiUploader({ onUpload, maxFiles = 20 }: EmojiUploaderProps) {
    const uploadEmoji = useUploadEmoji();
    const upload = useCallback((file: File) => uploadEmoji.mutateAsync(file), [uploadEmoji]);

    return (
        <Uploader<EmojiUploadResult>
            upload={upload}
            onUploaded={onUpload}
            accept="image/png,image/jpeg,image/gif,image/webp"
            maxSize={10 * 1024 * 1024}
            maxFiles={maxFiles}
            label="拖拽或点击上传图片"
            hint="PNG、JPG、GIF、WebP，最大 10MB"
        />
    );
}
