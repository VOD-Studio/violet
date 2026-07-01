import type { MediaFile } from "@entities/media/model/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { FilePreview } from "@/shared/ui/file-preview";
import { ImagePreview } from "@/shared/ui/image-preview";
import { Modal } from "@/shared/ui/modal";

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
    // fullscreen 存数据，fullscreenOpen 控开关：关闭时先把 open 置 false 让
    // ImagePreview 内部 AnimatePresence 播放退出动画（缩回淡出），动画结束
    // （onExitComplete）才真正清数据，避免直接卸载导致闪退、无关闭动画。
    //
    // 注意：全屏期间 Dialog 卸载会让触发图片 DOM 也被移除，因此打开时即快照
    // 触发元素的 rect，关闭动画据此缩回正确位置（而非运行时读已卸载的 DOM）。
    const [fullscreen, setFullscreen] = useState<{
        url: string;
        thumbnail: string | null;
        triggerRect: DOMRect | null;
    } | null>(null);
    const [fullscreenOpen, setFullscreenOpen] = useState(false);
    const openFullscreen = useCallback(
        (url: string, trigger?: HTMLElement | null, thumbnail?: string) => {
            setFullscreen({
                url,
                thumbnail: thumbnail ?? null,
                triggerRect: trigger ? trigger.getBoundingClientRect() : null,
            });
            setFullscreenOpen(true);
        },
        [],
    );
    const closeFullscreen = useCallback(() => setFullscreenOpen(false), []);
    const handleFullscreenExitComplete = useCallback(() => setFullscreen(null), []);
    // 全屏期间把 Dialog 切为 modal={false}（避免 Radix modal 锁定全屏层），但 modal={false}
    // 默认会响应外部点击/ESC 关闭——这里阻止之，防止全屏期间 Dialog 被误关。
    const blockDialogDismiss = useCallback((e: Event) => e.preventDefault(), []);

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
    // 视频贴边占满宽度（控制栏进度条需占满），其余类型留 padding。
    // 全屏期间 Dialog 切为 modal={false}（详见上面 blockDialogDismiss 注释），
    // 与全屏 ImagePreview 同时渲染，关闭时重叠过渡而非串行。
    const isVideo = file.mime_type.startsWith("video/");

    return (
        <>
            <Modal
                open={open}
                onOpenChange={onOpenChange}
                modal={!fullscreenOpen}
                size="xl"
                footer={null}
                unstyled
                showCloseButton
                titleSrOnly
                title={file.original_name}
                onInteractOutside={fullscreenOpen ? blockDialogDismiss : undefined}
                onEscapeKeyDown={fullscreenOpen ? blockDialogDismiss : undefined}
                className="max-w-[95vw] gap-0 border-none bg-background/95 sm:rounded-lg"
            >
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
            </Modal>

            {/* 全屏图片预览：与 Dialog 同时存在，渲染在其上层（z-9999）。
                关闭时全屏淡出缩回，Dialog 在底层自然显露，二者重叠过渡。 */}
            {fullscreen ? (
                <ImagePreview
                    open={fullscreenOpen}
                    onClose={closeFullscreen}
                    onExitComplete={handleFullscreenExitComplete}
                    images={[fullscreen.url]}
                    thumbnails={fullscreen.thumbnail ? [fullscreen.thumbnail] : undefined}
                    triggerRect={fullscreen.triggerRect}
                />
            ) : null}
        </>
    );
}
