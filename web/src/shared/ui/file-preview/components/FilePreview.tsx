/**
 * FilePreview - 文件预览主分发器
 *
 * 按文件类型（MIME + 扩展名）路由到对应的预览组件：
 * - 图片 → FilePreviewImage（file-preview 套件内）
 * - 视频 → VideoPreview（video-preview 套件）
 * - 音频 → AudioPreview（audio-preview 套件）
 * - 其余（PDF/Office/压缩包/代码/Markdown 等）暂走 FilePlaceholder
 *   后续阶段逐步接入 PDF/文档/压缩包/代码/Markdown 预览。
 */

import { AudioPreview } from "@/shared/ui/audio-preview";
import { VideoPreview } from "@/shared/ui/video-preview";
import type { FilePreviewComponentProps } from "../types/file-preview-types";
import { getFileKind } from "../utils/mime-utils";
import { FilePlaceholder } from "./FilePlaceholder";
import { FilePreviewImage } from "./ImagePreview";

export function FilePreview({
    url,
    thumbnailUrl,
    mimeType,
    name,
    size,
    showInfo = true,
    className,
    delay = 0,
    ref,
}: FilePreviewComponentProps) {
    const kind = getFileKind(mimeType, name);

    function renderPreview() {
        switch (kind) {
            case "image":
                return (
                    <FilePreviewImage
                        url={url}
                        thumbnailUrl={thumbnailUrl}
                        name={name}
                        delay={delay}
                    />
                );
            case "video":
                return (
                    <VideoPreview
                        url={url}
                        mimeType={mimeType}
                        name={name}
                        metadata={size !== undefined ? { size } : undefined}
                    />
                );
            case "audio":
                return <AudioPreview url={url} mimeType={mimeType} name={name} />;
            // 其余类型（pdf/docx/spreadsheet/presentation/archive/markdown/code/text/other）
            // 后续阶段逐步接入，暂走占位
            default:
                return (
                    <FilePlaceholder
                        url={url}
                        name={name}
                        mimeType={mimeType}
                        hint="此格式暂不支持在线预览"
                    />
                );
        }
    }

    return (
        <div className={`space-y-3 ${className ?? ""}`} ref={ref}>
            <div className="overflow-hidden rounded-lg border bg-background">{renderPreview()}</div>

            {showInfo && name ? (
                <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
                    <span className="truncate">{name}</span>
                    {size !== undefined ? (
                        <span className="ml-2 shrink-0">{formatSizeInline(size)}</span>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

/** 内联文件大小格式化（信息条用） */
function formatSizeInline(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type { FilePreviewProps } from "../types/file-preview-types";
export default FilePreview;
