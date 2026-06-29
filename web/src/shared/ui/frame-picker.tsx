"use client";

import { Film } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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

const SEEK_DEBOUNCE_MS = 120;

/**
 * FramePicker - 视频选帧器（B站风格）
 *
 * 通用组件，可在素材管理、文章编辑器、视频上传等多处复用。
 *
 * 交互优化（解决拖动卡顿 + 加帧预览）：
 * - 拖动进度条时只更新 UI 位置，不立即 seek；松手/停顿 120ms 后才 seek（防抖），
 *   避免频繁 seek 导致画面闪烁卡顿
 * - hover/拖动进度条时显示浮动帧预览气泡（第二个隐藏 video seek + canvas 截图）
 * - 主视频区显示当前选中帧
 *
 * 截帧原理：video.currentTime seek → canvas.drawImage → toBlob("image/jpeg")
 * 需要 video 设置 crossOrigin="anonymous" 避免 canvas 污染（tainted）。
 */
export function FramePicker({
    src,
    onConfirm,
    onCancel,
    submitting = false,
    confirmLabel = "设为封面",
}: FramePickerProps) {
    // 主视频（预览区）
    const videoRef = useRef<HTMLVideoElement>(null);
    // 预览视频（hover/drag 时实时截帧用）
    const previewVideoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const seekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const previewSeekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const trackRef = useRef<HTMLDivElement>(null);

    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isSeeking, setIsSeeking] = useState(false);
    const [error, setError] = useState("");
    // hover 预览气泡
    const [hoverPercent, setHoverPercent] = useState<number | null>(null);
    const [hoverTime, setHoverTime] = useState(0);
    const [previewSrc, setPreviewSrc] = useState("");

    // 视频元数据加载完成
    const handleLoadedMetadata = () => {
        const video = videoRef.current;
        if (!video) return;
        setDuration(video.duration);
        // 默认定位到第 1 秒（与后端 ffmpeg 兜底一致）
        const initial = Math.min(1, video.duration);
        video.currentTime = initial;
        setCurrentTime(initial);
    };

    const handleSeeked = () => {
        const video = videoRef.current;
        if (!video) return;
        setCurrentTime(video.currentTime);
        setIsSeeking(false);
    };

    const handleError = () => setError("视频加载失败，可能是格式不支持或跨域限制");

    // 清理定时器
    useEffect(() => {
        return () => {
            if (seekTimerRef.current) clearTimeout(seekTimerRef.current);
            if (previewSeekTimerRef.current) clearTimeout(previewSeekTimerRef.current);
        };
    }, []);

    // 拖动进度条：防抖 seek（拖动时只更新 UI，停顿后才实际 seek）
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number.parseFloat(e.target.value);
        setCurrentTime(time);
        setIsSeeking(true);
        // 拖动时也更新预览气泡位置
        setHoverTime(time);
        const percent = duration > 0 ? (time / duration) * 100 : 0;
        setHoverPercent(percent);

        if (seekTimerRef.current) clearTimeout(seekTimerRef.current);
        seekTimerRef.current = setTimeout(() => {
            const video = videoRef.current;
            if (video) video.currentTime = time;
        }, SEEK_DEBOUNCE_MS);
    };

    // hover 进度条：显示预览气泡
    const handleTrackMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const track = trackRef.current;
        if (!track || duration === 0) return;
        const rect = track.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = percent * duration;
        setHoverPercent(percent * 100);
        setHoverTime(time);

        // 防抖 seek 预览视频
        if (previewSeekTimerRef.current) clearTimeout(previewSeekTimerRef.current);
        previewSeekTimerRef.current = setTimeout(() => {
            const pv = previewVideoRef.current;
            if (pv) pv.currentTime = time;
        }, 80);
    };

    const handleTrackLeave = () => {
        setHoverPercent(null);
    };

    // 预览视频 seeked：截帧更新气泡
    const handlePreviewSeeked = () => {
        const pv = previewVideoRef.current;
        const canvas = canvasRef.current;
        if (!pv || !canvas) return;
        const w = pv.videoWidth;
        const h = pv.videoHeight;
        if (w === 0 || h === 0) return;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        try {
            ctx.drawImage(pv, 0, 0, w, h);
            setPreviewSrc(canvas.toDataURL("image/jpeg", 0.7));
        } catch {
            // canvas 污染时静默
        }
    };

    // 截取当前帧为 JPEG Blob（确认时用）
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
                {isSeeking ? (
                    <div className="absolute right-2 bottom-2 rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white">
                        定位中…
                    </div>
                ) : null}
            </div>

            {/* 进度条 + 帧预览气泡 */}
            {!error ? (
                <div className="space-y-2">
                    <div className="relative">
                        {/* 帧预览气泡 */}
                        {hoverPercent !== null ? (
                            <div
                                className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full"
                                style={{ left: `${hoverPercent}%` }}
                            >
                                <div className="overflow-hidden rounded border bg-black shadow-lg">
                                    {previewSrc ? (
                                        <img
                                            src={previewSrc}
                                            alt="帧预览"
                                            className="h-20 w-32 object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-20 w-32 items-center justify-center text-[10px] text-muted-foreground">
                                            加载中…
                                        </div>
                                    )}
                                    <p className="bg-black/80 py-0.5 text-center font-mono text-[10px] text-white">
                                        {formatTime(hoverTime)}
                                    </p>
                                </div>
                            </div>
                        ) : null}

                        {/* 可交互的进度条轨道 */}
                        <div
                            ref={trackRef}
                            className="flex h-6 cursor-pointer items-center"
                            onMouseMove={handleTrackMove}
                            onMouseLeave={handleTrackLeave}
                        >
                            <div className="relative h-1.5 w-full rounded-full bg-muted">
                                {/* 已播放进度 */}
                                <div
                                    className="absolute top-0 left-0 h-full rounded-full bg-primary"
                                    style={{
                                        width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                                    }}
                                />
                                {/* 拖动手柄 */}
                                <div
                                    className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background shadow"
                                    style={{
                                        left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                                    }}
                                />
                            </div>
                            {/* 原生 range 覆盖在上层（透明，仅接收交互） */}
                            <input
                                type="range"
                                min={0}
                                max={duration || 0}
                                step={0.05}
                                value={currentTime}
                                onChange={handleSliderChange}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                aria-label="选择帧位置"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
                        <span>{formatTime(currentTime)}</span>
                        <span className="text-center text-[11px]">
                            拖动滑块或悬停预览选择封面帧
                        </span>
                        <span>{formatTime(duration)}</span>
                    </div>
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

            {/* 隐藏的预览视频 + canvas */}
            {/* biome-ignore lint/a11y/useMediaCaption: 预览截帧用，无字幕需求 */}
            <video
                ref={previewVideoRef}
                src={src}
                crossOrigin="anonymous"
                preload="metadata"
                className="hidden"
                onSeeked={handlePreviewSeeked}
            />
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
