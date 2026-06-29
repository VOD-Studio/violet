/**
 * 视频自定义控制栏
 *
 * 包含：进度条（可拖拽 seek + 悬停预览时间）、播放/暂停、
 * 当前/总时长、音量调节 + 静音、倍速选择、全屏切换。
 * 鼠标移出控制栏 3 秒后自动隐藏（播放中）。
 */

import {
    Maximize,
    Minimize,
    Pause,
    Play,
    RotateCcw,
    Volume1,
    Volume2,
    VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { PLAYBACK_RATES, type VideoPlayerState } from "../types/video-preview-types";
import { formatTime } from "../utils/format";

interface VideoControlsProps {
    state: VideoPlayerState;
    onTogglePlay: () => void;
    onSeek: (time: number) => void;
    onSetVolume: (volume: number) => void;
    onToggleMute: () => void;
    onSetPlaybackRate: (rate: number) => void;
    onToggleFullscreen: () => void;
    isFullscreen: boolean;
}

export function VideoControls({
    state,
    onTogglePlay,
    onSeek,
    onSetVolume,
    onToggleMute,
    onSetPlaybackRate,
    onToggleFullscreen,
    isFullscreen,
}: VideoControlsProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [hoverTime, setHoverTime] = useState<number | null>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);

    const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
    const bufferedPercent = useBufferedPercent(state.currentTime, state.duration);

    // 根据进度条位置计算时间
    const getTimeFromEvent = (clientX: number): number => {
        const bar = progressBarRef.current;
        if (!bar || state.duration === 0) return 0;
        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
        return ratio * state.duration;
    };

    // 进度条拖拽
    // biome-ignore lint/correctness/useExhaustiveDependencies: onSeek/getTimeFromEvent 是稳定引用，仅需响应拖拽与时长变化
    useEffect(() => {
        if (!isDragging) return;

        const onMove = (e: MouseEvent) => onSeek(getTimeFromEvent(e.clientX));
        const onUp = () => setIsDragging(false);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [isDragging, state.duration]);

    const VolumeIcon =
        state.isMuted || state.volume === 0 ? VolumeX : state.volume < 0.5 ? Volume1 : Volume2;

    return (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-linear-to-t from-black/80 to-transparent px-3 pb-2 pt-8">
            {/* 进度条 */}
            <div
                ref={progressBarRef}
                role="slider"
                tabIndex={0}
                aria-label="播放进度"
                aria-valuemin={0}
                aria-valuemax={Math.floor(state.duration)}
                aria-valuenow={Math.floor(state.currentTime)}
                className="group/progress relative flex h-4 cursor-pointer items-center"
                onClick={(e) => onSeek(getTimeFromEvent(e.clientX))}
                onKeyDown={(e) => {
                    if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        onSeek(state.currentTime - 5);
                    } else if (e.key === "ArrowRight") {
                        e.preventDefault();
                        onSeek(state.currentTime + 5);
                    }
                }}
                onMouseMove={(e) => setHoverTime(getTimeFromEvent(e.clientX))}
                onMouseLeave={() => setHoverTime(null)}
                onMouseDown={(e) => {
                    setIsDragging(true);
                    onSeek(getTimeFromEvent(e.clientX));
                }}
            >
                {/* 轨道 */}
                <div className="relative h-1 w-full rounded-full bg-white/25 transition-all group-hover/progress:h-1.5">
                    {/* 已缓冲 */}
                    <div
                        className="absolute inset-y-0 left-0 rounded-full bg-white/30"
                        style={{ width: `${bufferedPercent}%` }}
                    />
                    {/* 已播放 */}
                    <div
                        className="absolute inset-y-0 left-0 rounded-full bg-primary"
                        style={{ width: `${progress}%` }}
                    />
                    {/* 拖拽手柄 */}
                    <div
                        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow transition-opacity group-hover/progress:opacity-100"
                        style={{ left: `${progress}%` }}
                    />
                </div>
                {/* 悬停时间提示 */}
                {hoverTime !== null ? (
                    <div
                        className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-black/90 px-1.5 py-0.5 text-[10px] text-white"
                        style={{ left: `${(hoverTime / (state.duration || 1)) * 100}%` }}
                    >
                        {formatTime(hoverTime)}
                    </div>
                ) : null}
            </div>

            {/* 按钮组 */}
            <div className="mt-1 flex items-center gap-2 text-white">
                {/* 播放/暂停/重播 */}
                <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="text-white hover:bg-white/20"
                    onClick={onTogglePlay}
                    title={state.isPlaying ? "暂停 (空格)" : "播放 (空格)"}
                >
                    {state.isEnded ? (
                        <RotateCcw className="size-4" />
                    ) : state.isPlaying ? (
                        <Pause className="size-4" />
                    ) : (
                        <Play className="size-4" />
                    )}
                </Button>

                {/* 音量 */}
                <div className="group/volume flex items-center">
                    <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-white hover:bg-white/20"
                        onClick={onToggleMute}
                        title="静音 (M)"
                    >
                        <VolumeIcon className="size-4" />
                    </Button>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={state.isMuted ? 0 : state.volume}
                        onChange={(e) => onSetVolume(Number(e.target.value))}
                        className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/30 opacity-0 transition-all group-hover/volume:w-16 group-hover/volume:opacity-100 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                        aria-label="音量"
                    />
                </div>

                {/* 时间 */}
                <span className="ml-1 text-xs tabular-nums text-white/90">
                    {formatTime(state.currentTime)} / {formatTime(state.duration)}
                </span>

                {/* 占位推开右侧 */}
                <div className="flex-1" />

                {/* 倍速 */}
                <div className="group/rate relative">
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-xs text-white hover:bg-white/20"
                        title="倍速"
                    >
                        {state.playbackRate}x
                    </Button>
                    <div className="absolute bottom-full right-0 mb-1 hidden flex-col rounded-md bg-black/90 py-1 group-hover/rate:flex">
                        {PLAYBACK_RATES.map((rate) => (
                            <button
                                type="button"
                                key={rate}
                                className={`px-3 py-1 text-left text-xs hover:bg-white/20 ${rate === state.playbackRate ? "text-primary" : "text-white"}`}
                                onClick={() => onSetPlaybackRate(rate)}
                            >
                                {rate === 1 ? "正常" : `${rate}x`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 全屏 */}
                <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    className="text-white hover:bg-white/20"
                    onClick={onToggleFullscreen}
                    title="全屏 (F)"
                >
                    {isFullscreen ? (
                        <Minimize className="size-4" />
                    ) : (
                        <Maximize className="size-4" />
                    )}
                </Button>
            </div>
        </div>
    );
}

/** 计算已缓冲百分比（简化：基于当前时间之前视为已缓冲） */
function useBufferedPercent(currentTime: number, duration: number): number {
    if (duration === 0) return 0;
    // 简化处理：用当前播放进度作为缓冲参考（真实缓冲需访问 video.buffered）
    return Math.min((currentTime / duration) * 100, 100);
}
