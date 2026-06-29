/**
 * 音频播放器 Hook
 *
 * 基于原生 <audio> 元素封装，统一管理播放/暂停、进度、音量、倍速、循环，
 * 并提供键盘快捷键。比 wavesurfer 更轻量、更稳定，配合自定义进度条 UI
 * 实现音乐播放器风格。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioLoadStatus, AudioPlayerState } from "../types/audio-preview-types";

interface UseAudioPlayerOptions {
    url: string;
    autoPlay?: boolean;
    enableShortcuts?: boolean;
}

export function useAudioPlayer({
    url,
    autoPlay = false,
    enableShortcuts = true,
}: UseAudioPlayerOptions) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [state, setState] = useState<AudioPlayerState>({
        isPlaying: false,
        isReady: false,
        currentTime: 0,
        duration: 0,
        volume: 1,
        isMuted: false,
        playbackRate: 1,
        isLooping: false,
        isEnded: false,
    });
    const [loadStatus, setLoadStatus] = useState<AudioLoadStatus>("loading");

    const patch = useCallback((partial: Partial<AudioPlayerState>) => {
        setState((prev) => ({ ...prev, ...partial }));
    }, []);

    // ---- 媒体事件绑定 ----
    // biome-ignore lint/correctness/useExhaustiveDependencies: url 变化需重新绑定事件，patch 为稳定引用
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onLoadedMetadata = () => {
            patch({
                isReady: true,
                duration: audio.duration,
                volume: audio.volume,
                isMuted: audio.muted,
                playbackRate: audio.playbackRate,
            });
            setLoadStatus("ready");
            if (autoPlay) void audio.play().catch(() => {});
        };
        const onTimeUpdate = () => patch({ currentTime: audio.currentTime, isEnded: false });
        const onPlay = () => patch({ isPlaying: true, isEnded: false });
        const onPause = () => patch({ isPlaying: false });
        const onEnded = () => {
            if (audio.loop) {
                audio.currentTime = 0;
                void audio.play().catch(() => {});
            } else {
                patch({ isPlaying: false, isEnded: true });
            }
        };
        const onVolumeChange = () => patch({ volume: audio.volume, isMuted: audio.muted });
        const onRateChange = () => patch({ playbackRate: audio.playbackRate });
        const onError = () => setLoadStatus("error");

        audio.addEventListener("loadedmetadata", onLoadedMetadata);
        audio.addEventListener("timeupdate", onTimeUpdate);
        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);
        audio.addEventListener("ended", onEnded);
        audio.addEventListener("volumechange", onVolumeChange);
        audio.addEventListener("ratechange", onRateChange);
        audio.addEventListener("error", onError);

        // 兜底：<audio> 在插入 DOM 后即开始请求（preload="metadata"），loadedmetadata
        // 是异步事件，可能在 useEffect 绑定监听器之前就已触发导致事件丢失 → 永久 loading。
        // 若元数据已就绪，直接复用处理函数同步置 ready。
        if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
            onLoadedMetadata();
        }

        return () => {
            audio.removeEventListener("loadedmetadata", onLoadedMetadata);
            audio.removeEventListener("timeupdate", onTimeUpdate);
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onPause);
            audio.removeEventListener("ended", onEnded);
            audio.removeEventListener("volumechange", onVolumeChange);
            audio.removeEventListener("ratechange", onRateChange);
            audio.removeEventListener("error", onError);
        };
    }, [autoPlay, patch, url]);

    // ---- 控制方法 ----
    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (audio.paused || audio.ended) {
            void audio.play().catch(() => {});
        } else {
            audio.pause();
        }
        patch({ isEnded: false });
    }, [patch]);

    const stop = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
        patch({ isEnded: false, currentTime: 0 });
    }, [patch]);

    const seek = useCallback(
        (time: number) => {
            const audio = audioRef.current;
            if (!audio) return;
            const clamped = Math.max(0, Math.min(time, audio.duration || 0));
            audio.currentTime = clamped;
            patch({ currentTime: clamped, isEnded: false });
        },
        [patch],
    );

    const seekBy = useCallback(
        (delta: number) => {
            const audio = audioRef.current;
            if (!audio) return;
            seek(audio.currentTime + delta);
        },
        [seek],
    );

    const setVolume = useCallback((v: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        const clamped = Math.max(0, Math.min(v, 1));
        audio.volume = clamped;
        audio.muted = clamped === 0;
    }, []);

    const toggleMute = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.muted = !audio.muted;
    }, []);

    const setPlaybackRate = useCallback((rate: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.playbackRate = rate;
    }, []);

    const toggleLoop = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.loop = !audio.loop;
        patch({ isLooping: audio.loop });
    }, [patch]);

    // ---- 键盘快捷键 ----
    useEffect(() => {
        if (!enableShortcuts) return;
        const container = containerRef.current;
        if (!container) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
            switch (e.key) {
                case " ":
                    e.preventDefault();
                    togglePlay();
                    break;
                case "ArrowLeft":
                    e.preventDefault();
                    seekBy(-5);
                    break;
                case "ArrowRight":
                    e.preventDefault();
                    seekBy(5);
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    setVolume(state.volume + 0.1);
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    setVolume(state.volume - 0.1);
                    break;
                case "m":
                case "M":
                    toggleMute();
                    break;
            }
        };

        container.addEventListener("keydown", handleKeyDown);
        return () => container.removeEventListener("keydown", handleKeyDown);
    }, [enableShortcuts, togglePlay, seekBy, setVolume, toggleMute, state.volume]);

    const retry = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        setLoadStatus("loading");
        audio.load();
    }, []);

    return {
        audioRef,
        containerRef,
        state,
        loadStatus,
        togglePlay,
        stop,
        seek,
        seekBy,
        setVolume,
        toggleMute,
        setPlaybackRate,
        toggleLoop,
        retry,
    };
}
