/**
 * 视频播放器 Hook
 *
 * 封装原生 <video> 元素，统一管理播放状态、音量、倍速、进度，
 * 并提供键盘快捷键（空格 播放/暂停、←→ 快进退、↑↓ 音量、F 全屏、M 静音）。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoLoadStatus, VideoPlayerState } from "../types/video-preview-types";

const INITIAL_STATE: VideoPlayerState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    playbackRate: 1,
    isWaiting: false,
    isEnded: false,
};

/** 快进/退步长（秒） */
const SEEK_STEP = 5;
/** 音量步长 */
const VOLUME_STEP = 0.1;

interface UseVideoPlayerOptions {
    /** 是否自动播放 */
    autoPlay?: boolean;
    /** 键盘快捷键启用（默认 true） */
    enableShortcuts?: boolean;
}

/**
 * @returns videoRef 绑定到 <video>；state 播放状态；loadStatus 加载状态；
 *          一组控制方法；containerRef 用于全屏
 */
export function useVideoPlayer({
    autoPlay = false,
    enableShortcuts = true,
}: UseVideoPlayerOptions = {}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [state, setState] = useState<VideoPlayerState>(INITIAL_STATE);
    const [loadStatus, setLoadStatus] = useState<VideoLoadStatus>("loading");

    // 局部更新状态
    const patch = useCallback((partial: Partial<VideoPlayerState>) => {
        setState((prev) => ({ ...prev, ...partial }));
    }, []);

    // ---- 播放控制 ----
    const play = useCallback(async () => {
        try {
            await videoRef.current?.play();
            patch({ isEnded: false });
        } catch {
            // 自动播放被浏览器拦截时静默处理
        }
    }, [patch]);

    const pause = useCallback(() => {
        videoRef.current?.pause();
    }, []);

    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused || video.ended) {
            void play();
        } else {
            pause();
        }
    }, [play, pause]);

    const seek = useCallback(
        (time: number) => {
            const video = videoRef.current;
            if (!video) return;
            const clamped = Math.max(0, Math.min(time, video.duration || 0));
            video.currentTime = clamped;
            patch({ currentTime: clamped, isEnded: false });
        },
        [patch],
    );

    const seekBy = useCallback(
        (delta: number) => {
            const video = videoRef.current;
            if (!video) return;
            seek(video.currentTime + delta);
        },
        [seek],
    );

    const setVolume = useCallback(
        (volume: number) => {
            const video = videoRef.current;
            if (!video) return;
            const clamped = Math.max(0, Math.min(volume, 1));
            video.volume = clamped;
            video.muted = clamped === 0;
            patch({ volume: clamped, isMuted: clamped === 0 });
        },
        [patch],
    );

    const toggleMute = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        const nextMuted = !video.muted;
        video.muted = nextMuted;
        patch({ isMuted: nextMuted });
    }, [patch]);

    const setPlaybackRate = useCallback(
        (rate: number) => {
            const video = videoRef.current;
            if (!video) return;
            video.playbackRate = rate;
            patch({ playbackRate: rate });
        },
        [patch],
    );

    const toggleFullscreen = useCallback(async () => {
        const container = containerRef.current;
        if (!container) return;
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else {
            await container.requestFullscreen();
        }
    }, []);

    // ---- 媒体事件绑定 ----
    const bindEvents = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;

        const onLoadedMetadata = () => {
            patch({
                duration: video.duration,
                volume: video.volume,
                isMuted: video.muted,
                playbackRate: video.playbackRate,
            });
            setLoadStatus("ready");
            if (autoPlay) void play();
        };
        const onTimeUpdate = () => patch({ currentTime: video.currentTime });
        const onPlay = () => patch({ isPlaying: true, isEnded: false });
        const onPause = () => patch({ isPlaying: false });
        const onWaiting = () => patch({ isWaiting: true });
        const onPlaying = () => patch({ isWaiting: false });
        const onEnded = () => patch({ isPlaying: false, isEnded: true });
        const onVolumeChange = () => patch({ volume: video.volume, isMuted: video.muted });
        const onRateChange = () => patch({ playbackRate: video.playbackRate });
        const onError = () => setLoadStatus("error");

        video.addEventListener("loadedmetadata", onLoadedMetadata);
        video.addEventListener("timeupdate", onTimeUpdate);
        video.addEventListener("play", onPlay);
        video.addEventListener("pause", onPause);
        video.addEventListener("waiting", onWaiting);
        video.addEventListener("playing", onPlaying);
        video.addEventListener("ended", onEnded);
        video.addEventListener("volumechange", onVolumeChange);
        video.addEventListener("ratechange", onRateChange);
        video.addEventListener("error", onError);

        // 兜底：<video> 在插入 DOM 后即开始请求（preload="metadata"），loadedmetadata
        // 是异步事件，可能在 useEffect 绑定监听器之前就已触发导致事件丢失 → 永久 loading。
        // 若元数据已就绪，直接复用处理函数同步置 ready。
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
            onLoadedMetadata();
        }

        return () => {
            video.removeEventListener("loadedmetadata", onLoadedMetadata);
            video.removeEventListener("timeupdate", onTimeUpdate);
            video.removeEventListener("play", onPlay);
            video.removeEventListener("pause", onPause);
            video.removeEventListener("waiting", onWaiting);
            video.removeEventListener("playing", onPlaying);
            video.removeEventListener("ended", onEnded);
            video.removeEventListener("volumechange", onVolumeChange);
            video.removeEventListener("ratechange", onRateChange);
            video.removeEventListener("error", onError);
        };
    }, [autoPlay, patch, play]);

    // ---- 键盘快捷键 ----
    useEffect(() => {
        if (!enableShortcuts) return;
        const container = containerRef.current;
        if (!container) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // 避免在输入框内触发
            const target = e.target as HTMLElement;
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

            switch (e.key) {
                case " ":
                case "k":
                    e.preventDefault();
                    togglePlay();
                    break;
                case "ArrowLeft":
                    e.preventDefault();
                    seekBy(-SEEK_STEP);
                    break;
                case "ArrowRight":
                    e.preventDefault();
                    seekBy(SEEK_STEP);
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    setVolume(state.volume + VOLUME_STEP);
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    setVolume(state.volume - VOLUME_STEP);
                    break;
                case "f":
                case "F":
                    void toggleFullscreen();
                    break;
                case "m":
                case "M":
                    toggleMute();
                    break;
            }
        };

        container.addEventListener("keydown", handleKeyDown);
        return () => container.removeEventListener("keydown", handleKeyDown);
    }, [
        enableShortcuts,
        togglePlay,
        seekBy,
        setVolume,
        toggleFullscreen,
        toggleMute,
        state.volume,
    ]);

    const retry = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        setLoadStatus("loading");
        video.load();
    }, []);

    return {
        videoRef,
        containerRef,
        state,
        loadStatus,
        bindEvents,
        play,
        pause,
        togglePlay,
        seek,
        seekBy,
        setVolume,
        toggleMute,
        setPlaybackRate,
        toggleFullscreen,
        retry,
    };
}
