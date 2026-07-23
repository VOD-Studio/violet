/**
 * useMathAnchor 测试
 *
 * 锁定块级 atom 节点弹层定位修复：锚点必须取 view.nodeDOM(pos) 的真实 rect，
 * 而非 coordsAtPos——后者对块级 atom 节点返回零高度缝隙，导致 Radix 把弹层
 * 放在公式顶部覆盖整个公式。
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMathAnchor } from "../useMathAnchor";

function makeEditor(overrides: Partial<{ nodeDOM: unknown; coordsAtPos: unknown }> = {}) {
    return {
        view: {
            nodeDOM: overrides.nodeDOM ?? vi.fn(() => null),
            coordsAtPos:
                overrides.coordsAtPos ?? vi.fn(() => ({ left: 0, right: 0, top: 0, bottom: 0 })),
        },
    } as unknown as Parameters<typeof useMathAnchor>[1];
}

describe("useMathAnchor", () => {
    it("优先用 nodeDOM 的真实 rect（块级 atom 节点有完整尺寸）", () => {
        const fakeRect = { top: 100, bottom: 200, left: 50, right: 150, width: 100, height: 100 };
        const nodeEl = { getBoundingClientRect: () => fakeRect };
        const editor = makeEditor({ nodeDOM: vi.fn(() => nodeEl) });
        const getPos = vi.fn(() => 7);

        const { result } = renderHook(() => useMathAnchor(getPos, editor));
        const rect = result.current.current.getBoundingClientRect();

        expect(editor.view.nodeDOM).toHaveBeenCalledWith(7);
        expect(rect.top).toBe(100);
        expect(rect.bottom).toBe(200);
        expect(rect.height).toBe(100);
    });

    it("nodeDOM 取不到时回退到 coordsAtPos", () => {
        const editor = makeEditor({
            nodeDOM: vi.fn(() => null),
            coordsAtPos: vi.fn(() => ({ left: 10, right: 30, top: 40, bottom: 60 })),
        });
        const getPos = vi.fn(() => 3);

        const { result } = renderHook(() => useMathAnchor(getPos, editor));
        const rect = result.current.current.getBoundingClientRect();

        expect(editor.view.coordsAtPos).toHaveBeenCalledWith(3);
        expect(rect.top).toBe(40);
        expect(rect.height).toBe(20);
    });

    it("getPos 无效时返回空 DOMRect", () => {
        const editor = makeEditor();
        const { result } = renderHook(() => useMathAnchor(() => undefined, editor));
        const rect = result.current.current.getBoundingClientRect();
        expect(rect.width).toBe(0);
        expect(rect.height).toBe(0);
    });
});
