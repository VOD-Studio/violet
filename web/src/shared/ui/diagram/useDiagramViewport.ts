/**
 * useDiagramViewport - 图块缩放平移状态机（PRD-0011）
 *
 * 交互模型对齐 BookStack Mermaid Viewer：默认锁定态（页面滚动/选文本正常），
 * 解锁后进入缩放平移（滚轮以光标为中心缩放 + 指针拖拽平移），锁定/复位。
 * 纯函数 zoomAtPoint 与 clamp 抽在模块顶层，供单测直接覆盖（PRD Testing 决策）。
 */

import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { useCallback, useRef, useState } from "react";

export const VIEWPORT_SCALE_MIN = 0.25;
export const VIEWPORT_SCALE_MAX = 4;
/** 滚轮每格缩放步进（放大 1.1x / 缩小 1/1.1x） */
export const WHEEL_SCALE_FACTOR = 1.1;

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

interface DragSession {
    pointerId: number;
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
    const dragRef = useRef<DragSession | null>(null);

    /** 滚轮缩放：仅解锁态响应，以光标位置为缩放中心；preventDefault 阻止页面滚动 */
    const handleWheel = useCallback(
        (e: ReactWheelEvent) => {
            if (state.locked) return;
            e.preventDefault();
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const factor = e.deltaY < 0 ? WHEEL_SCALE_FACTOR : 1 / WHEEL_SCALE_FACTOR;
            setState((s) => ({
                ...zoomAtPoint(s, factor, e.clientX - rect.left, e.clientY - rect.top),
                locked: s.locked,
            }));
        },
        [state.locked],
    );

    const handlePointerDown = useCallback(
        (e: ReactPointerEvent) => {
            if (state.locked) return;
            e.preventDefault();
            dragRef.current = {
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                originX: state.translateX,
                originY: state.translateY,
            };
            // 指针捕获：拖出容器仍持续收到 move/up
            e.currentTarget.setPointerCapture?.(e.pointerId);
        },
        [state.locked, state.translateX, state.translateY],
    );

    const handlePointerMove = useCallback((e: ReactPointerEvent) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;
        setState((s) => ({
            ...s,
            translateX: drag.originX + e.clientX - drag.startX,
            translateY: drag.originY + e.clientY - drag.startY,
        }));
    }, []);

    const handlePointerUp = useCallback((e: ReactPointerEvent) => {
        if (dragRef.current?.pointerId === e.pointerId) {
            dragRef.current = null;
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

    return {
        containerRef,
        state,
        handleWheel,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        toggleLock,
        zoomIn,
        zoomOut,
        reset,
    };
}

export type DiagramViewportController = ReturnType<typeof useDiagramViewport>;
