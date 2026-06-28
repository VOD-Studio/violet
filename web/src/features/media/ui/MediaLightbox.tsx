import type { MediaFile } from "@features/media/model/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";

interface MediaLightboxProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    files: MediaFile[];
    /** 当前预览的文件索引 */
    index: number;
    onIndexChange: (index: number) => void;
}

/**
 * MediaLightbox - 素材灯箱预览
 *
 * 自建轻量灯箱（无第三方依赖）：
 * - 图片大图居中展示
 * - 视频用 <video controls>
 * - 其他类型显示文件信息卡片
 * - 左右箭头切换、ESC 关闭
 */
export function MediaLightbox({
    open,
    onOpenChange,
    files,
    index,
    onIndexChange,
}: MediaLightboxProps) {
    const file = files[index];

    const goPrev = useCallback(() => {
        if (index > 0) onIndexChange(index - 1);
    }, [index, onIndexChange]);

    const goNext = useCallback(() => {
        if (index < files.length - 1) onIndexChange(index + 1);
    }, [index, files.length, onIndexChange]);

    // 键盘左右切换
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") goPrev();
            if (e.key === "ArrowRight") goNext();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, goPrev, goNext]);

    if (!file) return null;

    const isImage = file.mime_type.startsWith("image/");
    const isVideo = file.mime_type.startsWith("video/");

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
                    {isImage ? (
                        <img
                            src={file.url}
                            alt={file.alt_text || file.original_name}
                            className="max-h-[80vh] max-w-full object-contain"
                        />
                    ) : isVideo ? (
                        // 管理后台内部预览，无需字幕轨道
                        // biome-ignore lint/a11y/useMediaCaption: 内部素材预览，无字幕需求
                        <video src={file.url} controls className="max-h-[80vh] max-w-full" />
                    ) : (
                        <div className="rounded-lg bg-white/5 p-8 text-center text-white">
                            <p className="text-lg font-medium">{file.original_name}</p>
                            <p className="mt-2 text-sm text-white/60">
                                {file.mime_type} · {(file.size / 1024).toFixed(1)} KB
                            </p>
                            <p className="mt-4 text-xs text-white/40">此文件类型不支持预览</p>
                        </div>
                    )}

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
