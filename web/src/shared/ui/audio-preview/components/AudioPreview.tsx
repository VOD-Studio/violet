/**
 * 音频预览主组件
 *
 * 完整的音频预览体验（wavesurfer.js 波形）：
 * - 波形可视化 + 可点击 seek
 * - 自定义控制栏（播放/暂停/停止、音量、倍速、循环）
 * - 加载/错误状态遮罩 + 重试
 * - 键盘快捷键（空格/←→/↑↓/M）
 */

import { useAudioPlayer } from "../hooks/useAudioPlayer";
import type { AudioPreviewProps } from "../types/audio-preview-types";
import { AudioControls } from "./AudioControls";
import { AudioCoverIcon, AudioOverlay } from "./AudioOverlay";

export function AudioPreview({
    url,
    name,
    className,
    autoPlay = false,
    waveHeight = 80,
}: AudioPreviewProps) {
    const player = useAudioPlayer({ url, autoPlay, waveHeight });
    const { state, loadStatus, containerRef } = player;

    return (
        <div
            className={`flex flex-col gap-4 rounded-lg border bg-card p-6 focus:outline-none ${className ?? ""}`}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: 音频播放器需聚焦接收键盘快捷键
            tabIndex={0}
            role="region"
            aria-label={name ?? "音频预览"}
        >
            {/* 顶部：封面图标 */}
            <div className="flex justify-center">
                <AudioCoverIcon />
            </div>

            {/* 波形容器（必须始终渲染，wavesurfer 才能初始化） */}
            <div className="relative w-full">
                <div ref={containerRef} className="min-h-20 w-full" />
                {/* 加载/错误遮罩叠在波形上方 */}
                {loadStatus !== "ready" ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-card">
                        <AudioOverlay loadStatus={loadStatus} onRetry={player.retry} />
                    </div>
                ) : null}
            </div>

            {/* 控制栏（就绪后显示） */}
            {loadStatus === "ready" ? (
                <AudioControls
                    state={state}
                    onTogglePlay={player.togglePlay}
                    onStop={player.stop}
                    onSetVolume={player.setVolume}
                    onToggleMute={player.toggleMute}
                    onSetPlaybackRate={player.setPlaybackRate}
                    onToggleLoop={player.toggleLoop}
                />
            ) : null}
        </div>
    );
}
