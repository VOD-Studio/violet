/**
 * 图片内容预览
 *
 * 内嵌在 FilePreview 中的图片展示。点击图片触发全屏预览：
 * - 优先调用 onImageClick，由调用方在顶层（modal Dialog 之外）渲染全屏 ImagePreview，
 *   避免全屏层嵌在 modal Dialog 内被锁定而无法交互。
 * - 未传 onImageClick 时（向后兼容），本组件自渲染全屏 ImagePreview。
 */

import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ImagePreview, useImagePreview } from "@/shared/ui/image-preview";
import type { ImagePreviewProps, LoadStatus } from "../types/file-preview-types";

export function ContentImage({
    url,
    thumbnailUrl,
    name,
    delay = 0,
    className,
    onImageClick,
}: ImagePreviewProps) {
    const preview = useImagePreview();
    const imgRef = useRef<HTMLImageElement>(null);
    const [status, setStatus] = useState<LoadStatus>("loading");
    const [loadOriginal, setLoadOriginal] = useState(delay === 0);

    useEffect(() => {
        if (delay === 0) return;
        const timer = setTimeout(() => setLoadOriginal(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    return (
        <div
            className={`relative flex min-h-50 items-center justify-center bg-black/5 ${className ?? ""}`}
        >
            {/* 缩略图占位（始终显示直到原图加载完成） */}
            {thumbnailUrl ? (
                <img
                    src={thumbnailUrl}
                    alt={name ?? "预览图片"}
                    className={`max-h-125 w-full object-contain blur-sm transition-opacity duration-300 ${status === "loaded" ? "opacity-0" : "opacity-100"}`}
                />
            ) : null}
            {/* 加载态（无缩略图时显示） */}
            {!thumbnailUrl && status === "loading" ? (
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            ) : null}
            {/* 错误态 */}
            {status === "error" ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <AlertCircle className="size-8" />
                    <span className="text-sm">图片加载失败</span>
                </div>
            ) : null}
            {/* 原图（可点击触发全屏预览） */}
            {loadOriginal ? (
                <button
                    type="button"
                    onClick={() => {
                        if (onImageClick) {
                            onImageClick(url, imgRef.current);
                        } else {
                            preview.openPreview([url], 0, imgRef.current ?? undefined);
                        }
                    }}
                    className="absolute inset-0 cursor-zoom-in"
                    title="点击全屏预览"
                >
                    <img
                        ref={imgRef}
                        src={url}
                        alt={name ?? "预览图片"}
                        className={`max-h-125 w-full object-contain transition-opacity duration-300 ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
                        onLoad={() => setStatus("loaded")}
                        onError={() => setStatus("error")}
                    />
                </button>
            ) : null}

            {/* 全屏预览（仅未提供 onImageClick 时自渲染；提供时由调用方在顶层渲染） */}
            {!onImageClick ? (
                <ImagePreview
                    open={preview.open}
                    onClose={preview.closePreview}
                    images={preview.images}
                    currentIndex={preview.currentIndex}
                    triggerElement={preview.triggerElement}
                />
            ) : null}
        </div>
    );
}
