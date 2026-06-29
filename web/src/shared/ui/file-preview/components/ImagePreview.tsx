import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ImagePreviewProps, LoadStatus } from "../types/file-preview-types";

/**
 * 图片预览
 *
 * 缩略图立即占位显示（blur 模糊态），delay 结束后加载原图，
 * 原图加载完成时淡入并淡出缩略图。支持加载/错误状态。
 */
export function FilePreviewImage({
    url,
    thumbnailUrl,
    name,
    delay = 0,
    className,
}: ImagePreviewProps) {
    const [loadOriginal, setLoadOriginal] = useState(delay === 0);
    const [status, setStatus] = useState<LoadStatus>("loading");

    // delay 结束后加载原图
    useEffect(() => {
        if (delay === 0) return;
        const timer = setTimeout(() => setLoadOriginal(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    return (
        <div
            className={`relative flex min-h-50 items-center justify-center bg-black/5 ${className ?? ""}`}
        >
            {/* 缩略图（始终显示直到原图加载完成） */}
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
            {/* 原图（delay 结束后才开始加载） */}
            {loadOriginal ? (
                <img
                    src={url}
                    alt={name ?? "预览图片"}
                    className={`absolute max-h-125 w-full object-contain transition-opacity duration-300 ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
                    onLoad={() => setStatus("loaded")}
                    onError={() => setStatus("error")}
                />
            ) : null}
        </div>
    );
}
