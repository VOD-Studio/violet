"use client";

import { Film } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/shared/ui/button";

interface FramePickerProps {
    /** 视频 URL */
    src: string;
    /** 确认选帧回调，返回 JPEG Blob */
    onConfirm: (frame: Blob) => void;
    /** 取消回调 */
    onCancel?: () => void;
    /** 是否正在提交（确认按钮 loading） */
    submitting?: boolean;
    /** 确认按钮文案，默认「设为封面」 */
    confirmLabel?: string;
}

/**
 * FramePicker - 视频选帧器（B站风格）
 *
 * 通用组件，可在素材管理、文章编辑器、视频上传等多处复用。
 *
 * 交互：
 * - 上方 video 预览区，显示当前帧
 * - 下方可拖动的进度条，拖动时实时 seek 到对应时间点并预览
 * - 时间显示（当前 / 总时长）
 * - 「设为封面」按钮：用 canvas 截取当前帧为 JPEG Blob，调 onConfirm
 *
 * 截帧原理：video.currentTime seek → canvas.drawImage → toBlob("image/jpeg")
 * 需要 video 设置 crossOrigin="anonymous" 避免 canvas 污染（tainted）。
 *
 * @example
 * <FramePicker
 *   src={file.url}
 *   onConfirm={(blob) => uploadThumbnail(file.id, new File([blob], "cover.jpg"))}
 * />
 */
export function FramePicker({
    src,
    onConfirm,
    onCancel,
    submitting = false,
    confirmLabel = "设为封面",
}: FramePickerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isSeeking, setIsSeeking] = useState(false);
    const [error, setError] = useState<string>("");

    // 视频元数据加载完成，获取时长
    const handleLoadedMetadata = () => {
        const video = videoRef.current;
        if (!video) return;
        setDuration(video.duration);
        // 默认定位到第 1 秒（与后端 ffmpeg 兜底一致）
        video.currentTime = Math.min(1, video.duration);
    };

    // 拖动进度条：实时 seek
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current;
        if (!video) return;
        const time = Number.parseFloat(e.target.value);
        setCurrentTime(time);
        setIsSeeking(true);
        video.currentTime = time;
    };

    // seek 完成，更新当前时间
    const handleSeeked = () => {
        const video = videoRef.current;
        if (!video) return;
        setCurrentTime(video.currentTime);
        setIsSeeking(false);
    };

    // 视频加载失败
    const handleError = () => {
        setError("视频加载失败，可能是格式不支持或跨域限制");
    };

    // 截取当前帧为 JPEG Blob
    const captureFrame = useCallback(async (): Promise<Blob | null> => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return null;

        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w === 0 || h === 0) return null;

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        try {
            ctx.drawImage(video, 0, 0, w, h);
            return new Promise<Blob | null>((resolve) => {
                canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
            });
        } catch {
            setError("截帧失败，可能是跨域限制导致 canvas 污染");
            return null;
        }
    }, []);

    const handleConfirm = async () => {
        const blob = await captureFrame();
        if (blob) onConfirm(blob);
    };

    return (
        <div className="space-y-3">
            {/* 视频预览区 */}
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
                {error ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Film className="size-8 opacity-40" />
                        <p className="px-4 text-center text-xs">{error}</p>
                    </div>
                ) : (
                    // 选帧器内部工具，视频仅用于截帧预览，无字幕需求
                    // biome-ignore lint/a11y/useMediaCaption: 内部截帧工具，无字幕需求
                    <video
                        ref={videoRef}
                        src={src}
                        crossOrigin="anonymous"
                        preload="metadata"
                        className="h-full w-full object-contain"
                        onLoadedMetadata={handleLoadedMetadata}
                        onSeeked={handleSeeked}
                        onError={handleError}
                    />
                )}
            </div>

            {/* 进度条 + 时间 */}
            {!error ? (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="w-12 text-right font-mono text-xs text-muted-foreground">
                            {formatTime(currentTime)}
                        </span>
                        <input
                            type="range"
                            min={0}
                            max={duration || 0}
                            step={0.1}
                            value={currentTime}
                            onChange={handleSliderChange}
                            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                            disabled={isSeeking && false}
                        />
                        <span className="w-12 font-mono text-xs text-muted-foreground">
                            {formatTime(duration)}
                        </span>
                    </div>
                    <p className="text-center text-xs text-muted-foreground">拖动滑块选择封面帧</p>
                </div>
            ) : null}

            {/* 操作区 */}
            <div className="flex justify-end gap-2">
                {onCancel ? (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        disabled={submitting}
                    >
                        取消
                    </Button>
                ) : null}
                <Button type="button" onClick={handleConfirm} disabled={submitting || !!error}>
                    {submitting ? "处理中…" : confirmLabel}
                </Button>
            </div>

            {/* 隐藏的 canvas 用于截帧 */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}

function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}
