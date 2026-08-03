/**
 * useDiagramViewport - 图块缩放平移状态机（PRD-0011）
 *
 * 交互模型对齐 BookStack Mermaid Viewer：默认锁定态（页面滚动/选文本正常），
 * 解锁后进入缩放平移（滚轮以光标为中心缩放 + 指针拖拽平移），锁定/复位。
 * 纯函数 zoomAtPoint 与 clamp 抽在模块顶层，供单测直接覆盖（PRD Testing 决策）。
 */

import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

export const VIEWPORT_SCALE_MIN = 0.25;
export const VIEWPORT_SCALE_MAX = 4;
/** 滚轮每格缩放步进（放大 1.1x / 缩小 1/1.1x） */
export const WHEEL_SCALE_FACTOR = 1.1;
/** 键盘方向键平移步进（px），对齐主流图查看器的方向键探索步幅 */
export const KEYBOARD_PAN_STEP = 40;

export interface ViewportTransform {
    scale: number;
    translateX: number;
    translateY: number;
}

export interface DiagramViewportState extends ViewportTransform {
    /** 锁定态：不响应缩放平移，transform 复位，页面滚动/选文本正常 */
    locked: boolean;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/** 两点欧氏距离（捏合缩放算双指距离用） */
export function distance(ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    return Math.sqrt(dx * dx + dy * dy);
}

/** 两点中点（捏合缩放中心取双指中点） */
export function midpoint(ax: number, ay: number, bx: number, by: number): { x: number; y: number } {
    return { x: (ax + bx) / 2, y: (ay + by) / 2 };
}

/**
 * 滚轮缩放的光标中心换算（纯函数）。
 *
 * 不变量：缩放前后光标下的内容坐标不变。
 * 内容坐标 = (point - translate) / scale → 新 translate = point - 内容坐标 * newScale
 * 即 newTranslate = point - (point - translate) * (newScale / scale)
 *
 * @param state 当前 transform（不含 locked）
 * @param factor 缩放倍数（>1 放大，<1 缩小）
 * @param pointX pointY 缩放中心（相对 transform 容器原点，即容器左上角）
 * @returns clamp 到 [VIEWPORT_SCALE_MIN, VIEWPORT_SCALE_MAX] 后的新 transform
 */
export function zoomAtPoint(
    state: ViewportTransform,
    factor: number,
    pointX: number,
    pointY: number,
): ViewportTransform {
    const scale = clamp(state.scale * factor, VIEWPORT_SCALE_MIN, VIEWPORT_SCALE_MAX);
    const ratio = scale / state.scale;
    return {
        scale,
        translateX: pointX - (pointX - state.translateX) * ratio,
        translateY: pointY - (pointY - state.translateY) * ratio,
    };
}

interface Point {
    x: number;
    y: number;
}

/** 单指拖拽会话：记录按下时的指针起点与当时的 translate */
interface DragSession {
    startX: number;
    startY: number;
    originX: number;
    originY: number;
}

export function useDiagramViewport() {
    const [state, setState] = useState<DiagramViewportState>({
        scale: 1,
        translateX: 0,
        translateY: 0,
        locked: true,
    });
    /** 缩放中心取值用的容器（按钮缩放以视口中心为锚，滚轮以光标为锚） */
    const containerRef = useRef<HTMLDivElement>(null);
    /** 活跃指针缓存：pointerId → 当前坐标。≥2 个指针触发捏合缩放 */
    const pointersRef = useRef<Map<number, Point>>(new Map());
    /** 单指拖拽会话（缓存内仅 1 指针时活跃） */
    const dragRef = useRef<DragSession | null>(null);
    /** 上一次捏合的双指距离（算 factor = curDist / prevDist） */
    const pinchDistRef = useRef<number | null>(null);

    /**
     * 滚轮缩放：仅解锁态响应，以光标位置为缩放中心；preventDefault 阻止页面滚动。
     * 必须用原生监听（passive: false）——React 的 onWheel 在 root 委托中注册为
     * passive，preventDefault 无效，滚轮会同时缩放图与滚动页面（React 17+ 已知限制）。
     */
    useEffect(() => {
        const el = containerRef.current;
        if (!el || state.locked) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const factor = e.deltaY < 0 ? WHEEL_SCALE_FACTOR : 1 / WHEEL_SCALE_FACTOR;
            setState((s) => ({
                ...zoomAtPoint(s, factor, e.clientX - rect.left, e.clientY - rect.top),
                locked: s.locked,
            }));
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [state.locked]);

    const handlePointerDown = useCallback(
        (e: ReactPointerEvent) => {
            if (state.locked) return;
            e.preventDefault();
            pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            // 指针捕获：拖出容器仍持续收到 move/up
            e.currentTarget.setPointerCapture?.(e.pointerId);

            const count = pointersRef.current.size;
            if (count === 1) {
                // 首个指针：进入拖拽会话，记录起点与当前 translate
                dragRef.current = {
                    startX: e.clientX,
                    startY: e.clientY,
                    originX: state.translateX,
                    originY: state.translateY,
                };
                pinchDistRef.current = null;
            } else if (count === 2) {
                // 第二个指针落下：进入捏合，清拖拽会话，记初始双指距离
                dragRef.current = null;
                const [a, b] = [...pointersRef.current.values()];
                pinchDistRef.current = distance(a.x, a.y, b.x, b.y);
            }
        },
        [state.locked, state.translateX, state.translateY],
    );

    const handlePointerMove = useCallback((e: ReactPointerEvent) => {
        const pointers = pointersRef.current;
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointers.size >= 2) {
            // 双指捏合缩放：factor = 当前距离 / 上次距离，中心取双指中点
            const [a, b] = [...pointers.values()];
            const curDist = distance(a.x, a.y, b.x, b.y);
            if (pinchDistRef.current !== null && pinchDistRef.current > 0) {
                const factor = curDist / pinchDistRef.current;
                const mid = midpoint(a.x, a.y, b.x, b.y);
                const rect = containerRef.current?.getBoundingClientRect();
                const originLeft = rect?.left ?? 0;
                const originTop = rect?.top ?? 0;
                setState((s) => ({
                    ...zoomAtPoint(s, factor, mid.x - originLeft, mid.y - originTop),
                    locked: s.locked,
                }));
            }
            pinchDistRef.current = curDist;
            return;
        }

        // 单指拖拽平移
        const drag = dragRef.current;
        if (!drag) return;
        setState((s) => ({
            ...s,
            translateX: drag.originX + e.clientX - drag.startX,
            translateY: drag.originY + e.clientY - drag.startY,
        }));
    }, []);

    const handlePointerUp = useCallback((e: ReactPointerEvent) => {
        const pointers = pointersRef.current;
        if (!pointers.has(e.pointerId)) return;
        pointers.delete(e.pointerId);

        const count = pointers.size;
        if (count === 0) {
            dragRef.current = null;
            pinchDistRef.current = null;
        } else if (count === 1) {
            // 从双指切回单指：用剩余指针重建拖拽会话（origin 用当前 translate）
            pinchDistRef.current = null;
            const [remainingId] = [...pointers.keys()];
            const p = pointers.get(remainingId);
            if (!p) return;
            setState((s) => {
                dragRef.current = {
                    startX: p.x,
                    startY: p.y,
                    originX: s.translateX,
                    originY: s.translateY,
                };
                return s;
            });
        }
    }, []);

    /** 锁定/解锁切换：解锁保留当前 transform；锁定复位到初始（PRD：锁定态复位） */
    const toggleLock = useCallback(() => {
        setState((s) =>
            s.locked
                ? { ...s, locked: false }
                : { scale: 1, translateX: 0, translateY: 0, locked: true },
        );
    }, []);

    /** 按钮缩放：以容器视口中心为锚（与滚轮光标锚互补） */
    const zoomAtCenter = useCallback((factor: number) => {
        setState((s) => {
            if (s.locked) return s;
            const rect = containerRef.current?.getBoundingClientRect();
            return {
                ...zoomAtPoint(s, factor, (rect?.width ?? 0) / 2, (rect?.height ?? 0) / 2),
                locked: s.locked,
            };
        });
    }, []);

    const zoomIn = useCallback(() => zoomAtCenter(WHEEL_SCALE_FACTOR), [zoomAtCenter]);
    const zoomOut = useCallback(() => zoomAtCenter(1 / WHEEL_SCALE_FACTOR), [zoomAtCenter]);
    const reset = useCallback(() => {
        setState((s) => ({ ...s, scale: 1, translateX: 0, translateY: 0 }));
    }, []);

    /**
     * 键盘缩放平移（T4 a11y）：
     * - Enter 在锁定/解锁两态下都切换锁
     * - 锁定态下方向键与缩放键不拦截 preventDefault，让位页面滚动
     * - 解锁态：+/= 放大、- 缩小、0 重置、方向键平移（scroll 方向约定）
     */
    const handleKeyDown = useCallback(
        (e: ReactKeyboardEvent) => {
            // Enter 切锁：两态通用入口（锁定态下唯一键盘交互）
            if (e.key === "Enter") {
                e.preventDefault();
                toggleLock();
                return;
            }
            // 锁定态：其余键不拦截，方向键让位页面滚动
            if (state.locked) return;

            switch (e.key) {
                case "+":
                case "=":
                    e.preventDefault();
                    zoomIn();
                    break;
                case "-":
                    e.preventDefault();
                    zoomOut();
                    break;
                case "0":
                    e.preventDefault();
                    reset();
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    setState((s) => ({ ...s, translateY: s.translateY + KEYBOARD_PAN_STEP }));
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    setState((s) => ({ ...s, translateY: s.translateY - KEYBOARD_PAN_STEP }));
                    break;
                case "ArrowLeft":
                    e.preventDefault();
                    setState((s) => ({ ...s, translateX: s.translateX + KEYBOARD_PAN_STEP }));
                    break;
                case "ArrowRight":
                    e.preventDefault();
                    setState((s) => ({ ...s, translateX: s.translateX - KEYBOARD_PAN_STEP }));
                    break;
            }
        },
        [state.locked, toggleLock, zoomIn, zoomOut, reset],
    );

    return {
        containerRef,
        state,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        handleKeyDown,
        toggleLock,
        zoomIn,
        zoomOut,
        reset,
    };
}

export type DiagramViewportController = ReturnType<typeof useDiagramViewport>;
