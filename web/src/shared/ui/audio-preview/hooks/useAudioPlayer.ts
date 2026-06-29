/**
 * 音频播放器 Hook
 *
 * 基于 wavesurfer.js（@wavesurfer/react 的 useWavesurfer）封装，
 * 统一管理播放/暂停、进度、音量、倍速、循环状态，并提供键盘快捷键。
 */

import { useWavesurfer } from "@wavesurfer/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { AudioLoadStatus, AudioPlayerState } from "../types/audio-preview-types";

interface UseAudioPlayerOptions {
    url: string;
    autoPlay?: boolean;
    waveHeight?: number;
    enableShortcuts?: boolean;
}

export function useAudioPlayer({
    url,
    autoPlay = false,
    waveHeight = 80,
    enableShortcuts = true,
}: UseAudioPlayerOptions) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [duration, setDuration] = useState(0);
    const [volume, setVolumeState] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRateState] = useState(1);
    const [isLooping, setIsLooping] = useState(false);
    const [isEnded, setIsEnded] = useState(false);
    const [loadStatus, setLoadStatus] = useState<AudioLoadStatus>("loading");
    const wsRefRef = useRef<WaveSurfer | null>(null);

    const options = useMemo(
        () => ({
            waveColor: "hsl(var(--muted-foreground) / 0.3)",
            progressColor: "hsl(var(--primary))",
            cursorColor: "hsl(var(--primary))",
            cursorWidth: 2,
            barWidth: 2,
            barRadius: 1,
            barGap: 2,
            height: waveHeight,
            url,
        }),
        [url, waveHeight],
    );

    const { wavesurfer, isReady, isPlaying, currentTime } = useWavesurfer({
        container: containerRef,
        ...options,
    });

    // 缓存 wavesurfer 实例引用（用于事件监听与销毁后的判断）
    useEffect(() => {
        wsRefRef.current = wavesurfer;
    }, [wavesurfer]);

    // ready 时初始化音量/倍速/时长，按需自动播放
    useEffect(() => {
        if (!isReady || !wavesurfer) return;
        setLoadStatus("ready");
        setDuration(wavesurfer.getDuration());
        wavesurfer.setVolume(volume);
        wavesurfer.setPlaybackRate(playbackRate);
        if (autoPlay) {
            void wavesurfer.play().catch(() => {});
        }
    }, [isReady, wavesurfer, autoPlay, volume, playbackRate]);

    // 监听结束事件（处理循环）
    useEffect(() => {
        if (!wavesurfer) return;
        const onTimeupdate = () => setIsEnded(false);
        const onEnd = () => {
            if (isLooping) {
                // 循环：回到开头重新播放
                wavesurfer.seekTo(0);
                void wavesurfer.play().catch(() => {});
            } else {
                setIsEnded(true);
            }
        };
        const onError = () => setLoadStatus("error");
        wavesurfer.on("timeupdate", onTimeupdate);
        wavesurfer.on("finish", onEnd);
        wavesurfer.on("error", onError);
        return () => {
            wavesurfer.un("timeupdate", onTimeupdate);
            wavesurfer.un("finish", onEnd);
            wavesurfer.un("error", onError);
        };
    }, [wavesurfer, isLooping]);

    // url 变化时重置加载状态
    // biome-ignore lint/correctness/useExhaustiveDependencies: url 是重置触发器，函数体内未直接使用
    useEffect(() => {
        setLoadStatus("loading");
        setIsEnded(false);
    }, [url]);

    // ---- 控制方法 ----
    const togglePlay = useCallback(() => {
        if (!wavesurfer) return;
        void wavesurfer.playPause();
        setIsEnded(false);
    }, [wavesurfer]);

    const stop = useCallback(() => {
        if (!wavesurfer) return;
        wavesurfer.stop();
        setIsEnded(false);
    }, [wavesurfer]);

    const seek = useCallback(
        (ratio: number) => {
            if (!wavesurfer) return;
            const clamped = Math.max(0, Math.min(ratio, 1));
            wavesurfer.seekTo(clamped);
            setIsEnded(false);
        },
        [wavesurfer],
    );

    const seekBy = useCallback(
        (deltaSec: number) => {
            if (!wavesurfer) return;
            const total = wavesurfer.getDuration();
            const target = (wavesurfer.getCurrentTime() + deltaSec) / total;
            seek(target);
        },
        [wavesurfer, seek],
    );

    const setVolume = useCallback(
        (v: number) => {
            const clamped = Math.max(0, Math.min(v, 1));
            setVolumeState(clamped);
            setIsMuted(clamped === 0);
            wavesurfer?.setVolume(clamped);
        },
        [wavesurfer],
    );

    const toggleMute = useCallback(() => {
        setIsMuted((prev) => {
            const next = !prev;
            wavesurfer?.setMuted(next);
            return next;
        });
    }, [wavesurfer]);

    const setPlaybackRate = useCallback(
        (rate: number) => {
            setPlaybackRateState(rate);
            wavesurfer?.setPlaybackRate(rate);
        },
        [wavesurfer],
    );

    const toggleLoop = useCallback(() => setIsLooping((prev) => !prev), []);

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
                    setVolume(volume + 0.1);
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    setVolume(volume - 0.1);
                    break;
                case "m":
                case "M":
                    toggleMute();
                    break;
            }
        };

        container.addEventListener("keydown", handleKeyDown);
        return () => container.removeEventListener("keydown", handleKeyDown);
    }, [enableShortcuts, togglePlay, seekBy, setVolume, toggleMute, volume]);

    const state: AudioPlayerState = {
        isPlaying,
        isReady,
        currentTime,
        duration,
        volume,
        isMuted,
        playbackRate,
        isLooping,
        isEnded,
    };

    const retry = useCallback(() => {
        if (!wavesurfer) return;
        setLoadStatus("loading");
        // 重新加载：调用 setOptions 再 decoders 触发重载较复杂，这里用重新加载 url
        wavesurfer.load(url);
    }, [wavesurfer, url]);

    return {
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
