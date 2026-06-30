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
import type { ImagePreviewProps } from "../types/file-preview-types";

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
    // 原图是否预载失败
    const [hasError, setHasError] = useState(false);
    // 原图是否已预载解码完成。用 new Image() 后台预载（不阻塞主线程解码），
    // onload 后才渲染可见 <img>（命中缓存秒显），避免弹窗打开时大图同步解码卡顿。
    const [decoded, setDecoded] = useState(false);

    // delay 到期后开始预载原图（delay=0 立即预载）
    useEffect(() => {
        const start = delay === 0 ? 0 : delay;
        const timer = setTimeout(() => {
            const probe = new Image();
            probe.onload = () => setDecoded(true);
            probe.onerror = () => setHasError(true);
            probe.src = url;
        }, start);
        return () => clearTimeout(timer);
    }, [delay, url]);

    return (
        <div
            className={`relative flex min-h-50 items-center justify-center bg-black/5 ${className ?? ""}`}
        >
            {/* 缩略图占位（原图预载解码完成后淡出） */}
            {thumbnailUrl ? (
                <img
                    src={thumbnailUrl}
                    alt={name ?? "预览图片"}
                    className={`max-h-125 w-full object-contain blur-sm transition-opacity duration-300 ${decoded ? "opacity-0" : "opacity-100"}`}
                />
            ) : null}
            {/* 加载态（无缩略图且原图未解码完成时显示） */}
            {!thumbnailUrl && !decoded && !hasError ? (
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
            ) : null}
            {/* 错误态 */}
            {hasError ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <AlertCircle className="size-8" />
                    <span className="text-sm">图片加载失败</span>
                </div>
            ) : null}
            {/* 原图（预载解码完成后渲染，命中缓存秒显；可点击触发全屏预览） */}
            {decoded ? (
                <button
                    type="button"
                    onClick={() => {
                        if (onImageClick) {
                            onImageClick(url, imgRef.current, thumbnailUrl);
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
                        // decoded=true 时原图已预载解码，此处命中缓存，直接显示不等待
                        className="max-h-125 w-full object-contain opacity-100 transition-opacity duration-300"
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
