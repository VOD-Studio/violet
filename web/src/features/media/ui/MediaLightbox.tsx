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

    // 视频预览时键盘左右切换（图片预览有自己的键盘逻辑）
    useEffect(() => {
        if (!open || isCurrentImage) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") goPrev();
            if (e.key === "ArrowRight") goNext();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, isCurrentImage, goPrev, goNext]);

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

    // 视频/音频/其他：Dialog 内嵌 FilePreview
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-4xl border-none bg-black/90 p-0 sm:rounded-lg"
                showCloseButton
            >
                <DialogTitle className="sr-only">{file.original_name}</DialogTitle>
                <div className="relative flex min-h-[50vh] items-center justify-center p-4">
                    {/* 左箭头 */}
                    {index > 0 ? (
                        <button
                            type="button"
                            onClick={goPrev}
                            className="absolute top-1/2 left-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                            aria-label="上一个"
                        >
                            <ChevronLeft className="size-6" />
                        </button>
                    ) : null}

                    {/* 内容 */}
                    <FilePreview
                        url={file.url}
                        thumbnailUrl={file.thumbnail || undefined}
                        mimeType={file.mime_type}
                        name={file.original_name}
                        size={file.size}
                        showInfo={false}
                        className="max-w-full"
                    />

                    {/* 右箭头 */}
                    {index < files.length - 1 ? (
                        <button
                            type="button"
                            onClick={goNext}
                            className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                            aria-label="下一个"
                        >
                            <ChevronRight className="size-6" />
                        </button>
                    ) : null}
                </div>

                {/* 底部信息 */}
                <div className="border-t border-white/10 px-4 py-2 text-xs text-white/60">
                    <span className="truncate">{file.original_name}</span>
                    <span className="ml-2">
                        {index + 1} / {files.length}
                    </span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
