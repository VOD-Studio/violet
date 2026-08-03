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
    distance,
    midpoint,
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

describe("distance（两点欧氏距离）", () => {
    it("水平两点距离为横坐标差", () => {
        expect(distance(0, 0, 100, 0)).toBeCloseTo(100);
    });

    it("垂直两点距离为纵坐标差", () => {
        expect(distance(50, 10, 50, 90)).toBeCloseTo(80);
    });

    it("斜向距离满足勾股定理", () => {
        // 3-4-5 直角三角形
        expect(distance(0, 0, 3, 4)).toBeCloseTo(5);
    });

    it("同点距离为 0", () => {
        expect(distance(7, 7, 7, 7)).toBe(0);
    });
});

describe("midpoint（两点中点）", () => {
    it("返回两点的算术中点", () => {
        expect(midpoint(0, 0, 100, 60)).toEqual({ x: 50, y: 30 });
    });

    it("同点返回自身", () => {
        expect(midpoint(42, 17, 42, 17)).toEqual({ x: 42, y: 17 });
    });

    it("负坐标也成立", () => {
        expect(midpoint(-20, -10, 20, 10)).toEqual({ x: 0, y: 0 });
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

/**
 * 构造最小 PointerEvent mock：仅含捏合测试所需的字段。
 * setPointerCapture 用空实现（真实 DOM 行为不影响状态机逻辑）。
 */
function pointer(pointerId: number, x: number, y: number): React.PointerEvent<Element> {
    return {
        pointerId,
        clientX: x,
        clientY: y,
        preventDefault: () => {},
        currentTarget: { setPointerCapture: () => {} },
    } as unknown as React.PointerEvent<Element>;
}

describe("useDiagramViewport 捏合缩放（双指）", () => {
    it("解锁后双指分开 → 放大；双指靠近 → 缩小", () => {
        const { result } = renderHook(() => useDiagramViewport());
        act(() => result.current.toggleLock());
        expect(result.current.state.scale).toBe(1);

        const { handlePointerDown, handlePointerMove } = result.current;

        // 第一帧：两指分别在 (100,150) 与 (200,150)，初始距离 100
        act(() => {
            handlePointerDown(pointer(1, 100, 150));
            handlePointerDown(pointer(2, 200, 150));
        });

        // 双指分开到距离 150（100→150，factor 1.5）→ 放大
        act(() => {
            handlePointerMove(pointer(1, 75, 150));
            handlePointerMove(pointer(2, 225, 150));
        });
        expect(result.current.state.scale).toBeGreaterThan(1);

        // 记录当前 scale，下一帧捏合靠近应缩小
        const scaleAfterSpread = result.current.state.scale;

        // 双指捏合靠近到距离 75（150→75，factor 0.5）→ 缩小
        act(() => {
            handlePointerMove(pointer(1, 125, 150));
            handlePointerMove(pointer(2, 175, 150));
        });
        expect(result.current.state.scale).toBeLessThan(scaleAfterSpread);
    });

    it("捏合缩放以双指中点为中心（中点不在原点时产生平移）", () => {
        const { result } = renderHook(() => useDiagramViewport());
        act(() => result.current.toggleLock());

        const { handlePointerDown, handlePointerMove } = result.current;

        // 两指中点 (150, 150)，不在容器原点 (0,0)
        act(() => {
            handlePointerDown(pointer(1, 100, 150));
            handlePointerDown(pointer(2, 200, 150));
            handlePointerMove(pointer(1, 50, 150));
            handlePointerMove(pointer(2, 250, 150));
        });
        // 放大后中点处内容应保持，故 transform 必然产生非零 translate
        expect(result.current.state.scale).toBeGreaterThan(1);
        expect(result.current.state.translateX).not.toBe(0);
    });

    it("抬一指后切回单指拖拽（不再缩放）", () => {
        const { result } = renderHook(() => useDiagramViewport());
        act(() => result.current.toggleLock());

        const { handlePointerDown, handlePointerMove, handlePointerUp } = result.current;

        // 双指落下并放大
        act(() => {
            handlePointerDown(pointer(1, 100, 150));
            handlePointerDown(pointer(2, 200, 150));
        });
        act(() => {
            handlePointerMove(pointer(1, 75, 150));
            handlePointerMove(pointer(2, 225, 150));
        });
        const scaleAfterPinch = result.current.state.scale;
        const txAfterPinch = result.current.state.translateX;

        // 抬起 pointer 2，剩单指
        act(() => handlePointerUp(pointer(2, 225, 150)));

        // 单指移动：应只改 translate 不改 scale
        act(() => handlePointerMove(pointer(1, 80, 140)));
        expect(result.current.state.scale).toBe(scaleAfterPinch);
        expect(result.current.state.translateX).not.toBe(txAfterPinch);
    });

    it("锁定态下双指不触发缩放", () => {
        const { result } = renderHook(() => useDiagramViewport());
        // 默认锁定
        const { handlePointerDown, handlePointerMove } = result.current;

        act(() => {
            handlePointerDown(pointer(1, 100, 150));
            handlePointerDown(pointer(2, 200, 150));
            handlePointerMove(pointer(1, 75, 150));
            handlePointerMove(pointer(2, 225, 150));
        });
        expect(result.current.state.scale).toBe(1);
    });
});
