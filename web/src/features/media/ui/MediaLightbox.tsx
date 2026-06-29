import type { MediaFile } from "@features/media/model/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { FilePreview } from "@/shared/ui/file-preview";
import { ImagePreview } from "@/shared/ui/image-preview";

interface MediaLightboxProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    files: MediaFile[];
    /** 当前预览的文件索引（在 files 中的位置） */
    index: number;
    onIndexChange: (index: number) => void;
    /** 触发预览的元素（用于图片预览从该位置展开动画） */
    triggerElement?: HTMLElement | null;
}

/**
 * MediaLightbox - 素材灯箱预览
 *
 * 按文件类型分流：
 * - 图片：用 ImagePreview 全屏预览（缩放/旋转/翻转/动画/缩略图导航），
 *   并在当前页所有图片之间切换。
 * - 视频/音频/其他：用 Dialog 内嵌 FilePreview 展示。
 */
export function MediaLightbox({
    open,
    onOpenChange,
    files,
    index,
    onIndexChange,
    triggerElement,
}: MediaLightboxProps) {
    const file = files[index];

    // 当前页所有图片及其在 files 中的索引，用于 ImagePreview 多图切换
    const { imageUrls, imageFileIndices } = useMemo(() => {
        const urls: string[] = [];
        const indices: number[] = [];
        files.forEach((f, i) => {
            if (f.mime_type.startsWith("image/")) {
                urls.push(f.url);
                indices.push(i);
            }
        });
        return { imageUrls: urls, imageFileIndices: indices };
    }, [files]);

    // 当前文件在图片列表中的索引
    const imageIndex = useMemo(() => {
        const i = imageFileIndices.indexOf(index);
        return i === -1 ? 0 : i;
    }, [imageFileIndices, index]);

    const isCurrentImage = !!file && file.mime_type.startsWith("image/");
    // 视频/音频有自己的播放器快捷键（←→ 快进退），灯箱不拦截其键盘事件
    const isCurrentMediaWithShortcuts =
        !!file && (file.mime_type.startsWith("video/") || file.mime_type.startsWith("audio/"));

    const close = useCallback(() => onOpenChange(false), [onOpenChange]);

    // 图片预览的索引变化回调：把图片列表索引映射回 files 索引
    const handleImageIndexChange = useCallback(
        (imageIdx: number) => {
            const fileIdx = imageFileIndices[imageIdx];
            if (fileIdx !== undefined) onIndexChange(fileIdx);
        },
        [imageFileIndices, onIndexChange],
    );

    const goPrev = useCallback(() => {
        if (index > 0) onIndexChange(index - 1);
    }, [index, onIndexChange]);

    const goNext = useCallback(() => {
        if (index < files.length - 1) onIndexChange(index + 1);
    }, [index, files.length, onIndexChange]);

    // 非媒体类型（文档/压缩包/代码等）的键盘左右切换
    // 图片走 ImagePreview（有自己的键盘逻辑），视频/音频走播放器（有快进退快捷键）
    useEffect(() => {
        if (!open || isCurrentImage || isCurrentMediaWithShortcuts) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") goPrev();
            if (e.key === "ArrowRight") goNext();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, isCurrentImage, isCurrentMediaWithShortcuts, goPrev, goNext]);

    // 图片预览：全屏 ImagePreview
    if (open && isCurrentImage) {
        return (
            <ImagePreview
                open={open}
                onClose={close}
                images={imageUrls}
                currentIndex={imageIndex}
                onIndexChange={handleImageIndexChange}
                triggerElement={triggerElement}
            />
        );
    }

    if (!file) return null;

    // 视频/音频/文档/其他：Dialog 内嵌 FilePreview（各套件自带完整 UI）
    // 视频贴边占满宽度（控制栏进度条需占满），其余类型留 padding
    const isVideo = file.mime_type.startsWith("video/");

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-[95vw] gap-0 border-none bg-background/95 p-0 sm:max-w-[1200px] sm:rounded-lg"
                showCloseButton
            >
                <DialogTitle className="sr-only">{file.original_name}</DialogTitle>

                {/* 顶部切换条：上一个/计数/下一个（文件名由各预览套件自行展示，避免重复） */}
                <div className="flex items-center justify-center gap-2 border-b px-3 py-2">
                    <button
                        type="button"
                        onClick={goPrev}
                        disabled={index <= 0}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                        aria-label="上一个"
                    >
                        <ChevronLeft className="size-4" />
                    </button>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground/60">
                        {index + 1} / {files.length}
                    </span>
                    <button
                        type="button"
                        onClick={goNext}
                        disabled={index >= files.length - 1}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
                        aria-label="下一个"
                    >
                        <ChevronRight className="size-4" />
                    </button>
                </div>

                {/* 预览内容（各套件自带边框/工具栏，用 unframed 避免双层边框） */}
                <div className={`max-h-[82vh] overflow-auto ${isVideo ? "" : "p-4"}`}>
                    <FilePreview
                        url={file.url}
                        thumbnailUrl={file.thumbnail || undefined}
                        mimeType={file.mime_type}
                        name={file.original_name}
                        size={file.size}
                        showInfo={false}
                        unframed
                        className="max-w-full"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
