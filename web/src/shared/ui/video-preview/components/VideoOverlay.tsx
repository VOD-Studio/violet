/**
 * 视频中央遮罩层
 *
 * 覆盖三种状态：
 * - loading：加载指示器
 * - error：错误提示 + 重试按钮
 * - 暂停时（非 loading/error）：中央大播放按钮
 */

import { AlertCircle, Play, RotateCcw } from "lucide-react";
import { Button } from "@/shared/ui/base/button";
import type { VideoLoadStatus } from "../types/video-preview-types";

interface VideoOverlayProps {
    loadStatus: VideoLoadStatus;
    isPlaying: boolean;
    isEnded: boolean;
    onPlay: () => void;
    onRetry: () => void;
}

export function VideoOverlay({
    loadStatus,
    isPlaying,
    isEnded,
    onPlay,
    onRetry,
}: VideoOverlayProps) {
    // 加载中
    if (loadStatus === "loading") {
        return (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
                <div className="size-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
            </div>
        );
    }

    // 加载失败
    if (loadStatus === "error") {
        return (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
                <AlertCircle className="size-10 text-red-400" />
                <p className="text-sm">视频加载失败</p>
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                    <RotateCcw className="mr-1.5 size-3.5" />
                    重试
                </Button>
            </div>
        );
    }

    // 暂停或结束时显示中央播放/重播按钮
    if (!isPlaying) {
        return (
            <button
                type="button"
                onClick={onPlay}
                className="group absolute inset-0 z-20 flex items-center justify-center bg-black/20 transition-colors hover:bg-black/30"
                aria-label={isEnded ? "重播" : "播放"}
            >
                <span className="flex size-16 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-transform group-hover:scale-110">
                    {isEnded ? (
                        <RotateCcw className="size-7" />
                    ) : (
                        <Play className="ml-1 size-7 fill-current" />
                    )}
                </span>
            </button>
        );
    }

    return null;
}
