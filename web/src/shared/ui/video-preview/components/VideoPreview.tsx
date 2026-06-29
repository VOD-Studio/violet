/**
 * 视频预览主组件
 *
 * 完整的视频预览体验：
 * - 自定义控制栏（播放/进度/音量/倍速/全屏）
 * - 中央遮罩（加载/错误/暂停态）
 * - 键盘快捷键（空格/←→/↑↓/F/M）
 * - 元信息展示
 * - 加载错误处理 + 重试
 * - 控制栏自动隐藏（播放中 3 秒无操作）
 */

import { useCallback, useEffect, useState } from "react";
import { useVideoPlayer } from "../hooks/useVideoPlayer";
import type { VideoPreviewProps } from "../types/video-preview-types";
import { VideoControls } from "./VideoControls";
import { VideoInfo } from "./VideoInfo";
import { VideoOverlay } from "./VideoOverlay";

export function VideoPreview({
    url,
    mimeType,
    name,
    metadata,
    className,
    autoPlay = false,
    poster,
}: VideoPreviewProps) {
    const player = useVideoPlayer({ autoPlay });
    const { state, loadStatus, videoRef, containerRef, bindEvents } = player;

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [controlsVisible, setControlsVisible] = useState(true);
    // 倍速菜单展开时暂停控制栏自动隐藏
    const [menuOpen, setMenuOpen] = useState(false);

    // 绑定媒体事件（url 变化时重新绑定）
    // biome-ignore lint/correctness/useExhaustiveDependencies: bindEvents 引用稳定，仅需响应 url 变化
    useEffect(() => {
        const cleanup = bindEvents();
        return cleanup;
    }, [bindEvents, url]);

    // 监听全屏状态
    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", handler);
        return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    // 播放中 3 秒无鼠标操作自动隐藏控制栏（菜单展开时不隐藏）
    // 鼠标移动会 setControlsVisible(true) 触发本 effect 重启计时，实现"动则显，静则隐"
    useEffect(() => {
        if (!state.isPlaying || !controlsVisible || menuOpen) return;
        const timer = setTimeout(() => setControlsVisible(false), 3000);
        return () => clearTimeout(timer);
    }, [state.isPlaying, controlsVisible, menuOpen]);

    // 鼠标移动时显示控制栏
    const handleMouseMove = useCallback(() => {
        setControlsVisible(true);
    }, []);

    return (
        <div
            ref={containerRef}
            className={`overflow-hidden rounded-lg border bg-black focus:outline-none ${className ?? ""}`}
            onMouseMove={handleMouseMove}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: 视频播放器需聚焦接收键盘快捷键
            tabIndex={0}
            role="region"
            aria-label={name ?? "视频预览"}
        >
            {/* 视频区域 */}
            <div className="group relative flex aspect-video w-full items-center justify-center">
                {/* biome-ignore lint/a11y/useMediaCaption: 内部素材预览，无字幕需求 */}
                <video
                    ref={videoRef}
                    src={url}
                    poster={poster}
                    playsInline
                    preload="metadata"
                    className="h-full w-full bg-black object-contain"
                    onClick={player.togglePlay}
                    onDoubleClick={player.toggleFullscreen}
                >
                    {mimeType ? <source src={url} type={mimeType} /> : null}
                </video>

                {/* 中央遮罩 */}
                <VideoOverlay
                    loadStatus={loadStatus}
                    isPlaying={state.isPlaying}
                    isEnded={state.isEnded}
                    onPlay={player.play}
                    onRetry={player.retry}
                />

                {/* 控制栏（ready 且可见时） */}
                {loadStatus === "ready" && controlsVisible ? (
                    <VideoControls
                        state={state}
                        menuOpen={menuOpen}
                        onMenuOpenChange={setMenuOpen}
                        onTogglePlay={player.togglePlay}
                        onSeek={player.seek}
                        onSetVolume={player.setVolume}
                        onToggleMute={player.toggleMute}
                        onSetPlaybackRate={player.setPlaybackRate}
                        onToggleFullscreen={player.toggleFullscreen}
                        isFullscreen={isFullscreen}
                    />
                ) : null}

                {/* 标题（可选） */}
                {name ? (
                    <div
                        className={`absolute top-0 right-0 left-0 bg-linear-to-b from-black/60 to-transparent px-3 py-2 text-sm text-white transition-opacity ${controlsVisible ? "opacity-100" : "opacity-0"}`}
                    >
                        <span className="line-clamp-1">{name}</span>
                    </div>
                ) : null}
            </div>

            {/* 元信息 */}
            <VideoInfo metadata={metadata} duration={state.duration} />
        </div>
    );
}
