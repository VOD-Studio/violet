/**
 * useRotation - banner 原型共享的轮播状态机
 *
 * 三条不变约束（来自 CONTEXT.md「翻滚交互」「翻滚可访问性」）：
 * (1) 默认自动推进，播放完一条切下一条，循环；
 * (2) hover 时暂停，移开后恢复；
 * (3) 滚轮可手动翻上/下一条；
 * (4) prefers-reduced-motion 下禁用自动推进（原型自行决定动画降级）。
 *
 * FlipX 与 CubeFlipY 原型共用此 hook。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { LabAnnouncement } from "./types";

export interface RotationState {
    /** 当前展示的公告 */
    current: LabAnnouncement;
    /** 当前索引 */
    index: number;
    /** 总数 */
    total: number;
    /** 切下一条 */
    next: () => void;
    /** 切上一条 */
    prev: () => void;
    /** 跳到指定索引（循环） */
    goTo: (i: number) => void;
    /** 是否暂停中（hover 时为 true） */
    isPaused: boolean;
    /** 鼠标进入/离开处理器，绑定到容器 */
    onHoverStart: () => void;
    onHoverEnd: () => void;
    /** 滚轮处理器，绑定到容器（防抖） */
    onWheel: (e: React.WheelEvent) => void;
    /** 系统是否要求减少动画 */
    prefersReducedMotion: boolean;
}

/**
 * 检测 prefers-reduced-motion（SSR 安全）
 *
 * 返回当前值并监听变化。与 theme-transition.tsx 的判空风格一致。
 */
function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReduced(mq.matches);
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);
    return reduced;
}

export function useRotation(items: LabAnnouncement[], intervalMs = 4000): RotationState {
    const [index, setIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const prefersReducedMotion = usePrefersReducedMotion();

    // 滚轮防抖 ref：短时间内多次 wheel 只触发一次切换
    const wheelLockRef = useRef(false);

    const total = items.length;
    const current = items[index] ?? items[0];

    const goTo = useCallback(
        (i: number) => {
            if (total === 0) return;
            // 循环取模
            setIndex(((i % total) + total) % total);
        },
        [total],
    );

    const next = useCallback(() => goTo(index + 1), [goTo, index]);
    const prev = useCallback(() => goTo(index - 1), [goTo, index]);

    const onHoverStart = useCallback(() => setIsPaused(true), []);
    const onHoverEnd = useCallback(() => setIsPaused(false), []);

    const onWheel = useCallback(
        (e: React.WheelEvent) => {
            if (wheelLockRef.current) return;
            if (Math.abs(e.deltaY) < 10) return; // 忽略微小滚动
            wheelLockRef.current = true;
            if (e.deltaY > 0) next();
            else prev();
            // 400ms 解锁，避免滚轮连续触发跳过多条
            window.setTimeout(() => {
                wheelLockRef.current = false;
            }, 400);
        },
        [next, prev],
    );

    // 自动推进：未暂停 && 未要求 reduced-motion && 多于 1 条
    useEffect(() => {
        if (isPaused || prefersReducedMotion || total <= 1) return;
        const timer = window.setInterval(() => {
            setIndex((prev) => (prev + 1) % total);
        }, intervalMs);
        return () => window.clearInterval(timer);
    }, [isPaused, prefersReducedMotion, total, intervalMs]);

    return {
        current,
        index,
        total,
        next,
        prev,
        goTo,
        isPaused,
        onHoverStart,
        onHoverEnd,
        onWheel,
        prefersReducedMotion,
    };
}
