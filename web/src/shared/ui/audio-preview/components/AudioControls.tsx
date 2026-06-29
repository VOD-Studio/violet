/**
 * 音频控制栏
 *
 * 包含：播放/暂停/停止、当前/总时长、音量调节 + 静音、倍速选择、循环开关。
 */

import { Pause, Play, Repeat, Repeat1, Square, Volume1, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { AUDIO_PLAYBACK_RATES, type AudioPlayerState } from "../types/audio-preview-types";
import { formatTime } from "../utils/format";

interface AudioControlsProps {
    state: AudioPlayerState;
    onTogglePlay: () => void;
    onStop: () => void;
    onSetVolume: (volume: number) => void;
    onToggleMute: () => void;
    onSetPlaybackRate: (rate: number) => void;
    onToggleLoop: () => void;
}

export function AudioControls({
    state,
    onTogglePlay,
    onStop,
    onSetVolume,
    onToggleMute,
    onSetPlaybackRate,
    onToggleLoop,
}: AudioControlsProps) {
    const VolumeIcon =
        state.isMuted || state.volume === 0 ? VolumeX : state.volume < 0.5 ? Volume1 : Volume2;

    return (
        <div className="flex flex-wrap items-center gap-2">
            {/* 播放/暂停/停止 */}
            <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={onTogglePlay}
                title={state.isPlaying ? "暂停 (空格)" : "播放 (空格)"}
            >
                {state.isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={onStop} title="停止">
                <Square className="size-4" />
            </Button>

            {/* 时间 */}
            <span className="ml-1 min-w-24 text-xs tabular-nums text-muted-foreground">
                {formatTime(state.currentTime)} / {formatTime(state.duration)}
            </span>

            {/* 占位推开右侧 */}
            <div className="flex-1" />

            {/* 音量 */}
            <div className="group/volume flex items-center">
                <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
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
                    className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-muted accent-primary [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                    aria-label="音量"
                />
            </div>

            {/* 倍速 */}
            <div className="group/rate relative">
                <Button type="button" size="sm" variant="ghost" className="text-xs" title="倍速">
                    {state.playbackRate}x
                </Button>
                <div className="absolute bottom-full right-0 mb-1 hidden flex-col rounded-md border bg-popover py-1 shadow-md group-hover/rate:flex">
                    {AUDIO_PLAYBACK_RATES.map((rate) => (
                        <button
                            type="button"
                            key={rate}
                            className={`px-3 py-1 text-left text-xs hover:bg-muted ${rate === state.playbackRate ? "font-medium text-primary" : "text-muted-foreground"}`}
                            onClick={() => onSetPlaybackRate(rate)}
                        >
                            {rate === 1 ? "正常" : `${rate}x`}
                        </button>
                    ))}
                </div>
            </div>

            {/* 循环 */}
            <Button
                type="button"
                size="icon-sm"
                variant={state.isLooping ? "secondary" : "ghost"}
                onClick={onToggleLoop}
                title={state.isLooping ? "关闭循环" : "单曲循环"}
            >
                {state.isLooping ? (
                    <Repeat1 className="size-4 text-primary" />
                ) : (
                    <Repeat className="size-4" />
                )}
            </Button>
        </div>
    );
}
