/**
 * useDiagramViewport 测试（PRD-0011 Testing Decisions）
 *
 * 纯函数 zoomAtPoint/clamp 直测；hook 行为用 @testing-library/react renderHook。
 * 交互手感（拖拽、滚轮事件）不测——PRD 声明手动验证。
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
    clamp,
    useDiagramViewport,
    VIEWPORT_SCALE_MAX,
    VIEWPORT_SCALE_MIN,
    zoomAtPoint,
} from "../useDiagramViewport";

describe("zoomAtPoint（光标中心缩放纯函数）", () => {
    const base = { scale: 1, translateX: 0, translateY: 0 };

    it("放大：scale 乘以 factor，光标下内容坐标保持不变", () => {
        const point = { x: 120, y: 60 };
        const next = zoomAtPoint(base, 1.1, point.x, point.y);
        // 不变量：(point - translate) / scale 在缩放前后相等
        const contentBefore = (point.x - base.translateX) / base.scale;
        const contentAfter = (point.x - next.translateX) / next.scale;
        expect(next.scale).toBeCloseTo(1.1);
        expect(contentAfter).toBeCloseTo(contentBefore);
        expect(next.translateY).toBeCloseTo(point.y - (point.y - 0) * 1.1);
    });

    it("缩小：factor < 1，同样保持光标下内容不动", () => {
        const state = { scale: 2, translateX: 40, translateY: -20 };
        const next = zoomAtPoint(state, 1 / 1.1, 200, 150);
        const contentBefore = (200 - state.translateX) / state.scale;
        const contentAfter = (200 - next.translateX) / next.scale;
        expect(next.scale).toBeCloseTo(2 / 1.1);
        expect(contentAfter).toBeCloseTo(contentBefore);
    });

    it("scale clamp：连续放大不超 4x", () => {
        let state = base;
        for (let i = 0; i < 30; i++) state = zoomAtPoint(state, 1.1, 0, 0);
        expect(state.scale).toBe(VIEWPORT_SCALE_MAX);
    });

    it("scale clamp：连续缩小不低于 0.25x", () => {
        let state = { ...base, scale: 1 };
        for (let i = 0; i < 30; i++) state = zoomAtPoint(state, 1 / 1.1, 0, 0);
        expect(state.scale).toBe(VIEWPORT_SCALE_MIN);
    });

    it("translate 随 scale clamp 同步换算（clamp 后仍满足不变量）", () => {
        const state = { scale: 3.9, translateX: 500, translateY: 300 };
        const next = zoomAtPoint(state, 1.1, 100, 100); // 3.9*1.1=4.29 → clamp 到 4
        expect(next.scale).toBe(VIEWPORT_SCALE_MAX);
        const contentBefore = (100 - state.translateX) / state.scale;
        const contentAfter = (100 - next.translateX) / next.scale;
        expect(contentAfter).toBeCloseTo(contentBefore);
    });
});

describe("clamp", () => {
    it("区间内原值、越界截断", () => {
        expect(clamp(2, 0.25, 4)).toBe(2);
        expect(clamp(0.1, 0.25, 4)).toBe(0.25);
        expect(clamp(9, 0.25, 4)).toBe(4);
    });
});

describe("useDiagramViewport", () => {
    it("初始锁定态，scale 1", () => {
        const { result } = renderHook(() => useDiagramViewport());
        expect(result.current.state.locked).toBe(true);
        expect(result.current.state.scale).toBe(1);
        expect(result.current.state.translateX).toBe(0);
    });

    it("锁定态下 zoomIn/zoomOut 不生效", () => {
        const { result } = renderHook(() => useDiagramViewport());
        act(() => result.current.zoomIn());
        expect(result.current.state.scale).toBe(1);
        act(() => result.current.zoomOut());
        expect(result.current.state.scale).toBe(1);
    });

    it("解锁后可缩放，再锁定复位到初始", () => {
        const { result } = renderHook(() => useDiagramViewport());
        act(() => result.current.toggleLock());
        expect(result.current.state.locked).toBe(false);
        act(() => result.current.zoomIn());
        expect(result.current.state.scale).toBeGreaterThan(1);
        act(() => result.current.toggleLock());
        expect(result.current.state.locked).toBe(true);
        expect(result.current.state.scale).toBe(1);
        expect(result.current.state.translateX).toBe(0);
        expect(result.current.state.translateY).toBe(0);
    });

    it("reset 复位 transform 但保持解锁态", () => {
        const { result } = renderHook(() => useDiagramViewport());
        act(() => result.current.toggleLock());
        act(() => result.current.zoomIn());
        act(() => result.current.reset());
        expect(result.current.state.scale).toBe(1);
        expect(result.current.state.locked).toBe(false);
    });
});
