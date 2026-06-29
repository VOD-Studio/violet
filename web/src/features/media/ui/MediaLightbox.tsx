import type { MediaFile } from "@features/media/model/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
 * 所有类型统一走 Dialog 内嵌 FilePreview；图片的 FilePreview 分支（ContentImage）
 * 点击后仍可触发全屏 ImagePreview（缩放/旋转/翻转/动画）。
 */
export function MediaLightbox({
    open,
    onOpenChange,
    files,
    index,
    onIndexChange,
}: MediaLightboxProps) {
    const file = files[index];

    // 全屏图片预览：渲染在 Dialog 之外（顶层），避免嵌在 modal Dialog 内被锁定导致
    // 控制按钮无法点击、点周围关全屏时连带关 Dialog 等问题。
    const [fullscreen, setFullscreen] = useState<{
        url: string;
        trigger: HTMLElement | null;
    } | null>(null);
    const openFullscreen = useCallback((url: string, trigger?: HTMLElement | null) => {
        setFullscreen({ url, trigger: trigger ?? null });
    }, []);
    const closeFullscreen = useCallback(() => setFullscreen(null), []);

    // 视频/音频有自己的播放器快捷键（←→ 快进退），灯箱不拦截其键盘事件
    const isCurrentMediaWithShortcuts =
        !!file && (file.mime_type.startsWith("video/") || file.mime_type.startsWith("audio/"));

    const goPrev = useCallback(() => {
        if (index > 0) onIndexChange(index - 1);
    }, [index, onIndexChange]);

    const goNext = useCallback(() => {
        if (index < files.length - 1) onIndexChange(index + 1);
    }, [index, files.length, onIndexChange]);

    // 非媒体类型（图片/文档/压缩包/代码等）的键盘左右切换
    // 视频/音频走播放器（有快进退快捷键），不在此拦截
    useEffect(() => {
        if (!open || isCurrentMediaWithShortcuts) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") goPrev();
            if (e.key === "ArrowRight") goNext();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, isCurrentMediaWithShortcuts, goPrev, goNext]);

    if (!file) return null;

    // 所有类型统一走 Dialog 内嵌 FilePreview（各套件自带完整 UI）；
    // 图片的 FilePreview 分支（ContentImage）点击后触发全屏 ImagePreview。
    // 视频贴边占满宽度（控制栏进度条需占满），其余类型留 padding
    const isVideo = file.mime_type.startsWith("video/");

    // 关键：全屏 ImagePreview 与 modal Dialog 不能同时存在。
    // Radix modal Dialog 的 DismissableLayer 会把 Content 外部的 pointerdown 判定为关闭信号，
    // 且 FocusScope 会锁定焦点 —— 导致全屏层嵌在 Dialog 期间：点全屏背景连 Dialog 一起关、
    // 放大/旋转等按钮无法点击。因此全屏期间卸载 Dialog，关闭全屏后再恢复。
    if (fullscreen) {
        return (
            <ImagePreview
                open
                onClose={closeFullscreen}
                images={[fullscreen.url]}
                triggerElement={fullscreen.trigger}
            />
        );
    }

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
                        onImageClick={openFullscreen}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
