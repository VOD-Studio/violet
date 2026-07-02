/**
 * EditorBubbleMenu 回归测试
 *
 * 核心场景：选中文本后的浮动工具条必须：
 * - 使用 fixed 定位策略，避免被 EditorToolbar 遮挡；
 * - 有高于 EditorToolbar（z-10）的 z-index；
 * - 监听编辑器内部滚动容器，滚动时无延迟跟随；
 * - 选择区滚出编辑器可视区后应隐藏。
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let capturedProps: Record<string, unknown> | null = null;
let mockRect: DOMRect = new DOMRect(0, 0, 0, 0);

const { fakeState } = vi.hoisted(() => ({
    fakeState: {
        selection: { empty: false },
    },
}));

vi.mock("@tiptap/core", () => ({
    posToDOMRect: () => mockRect,
}));

vi.mock("@tiptap/react/menus", () => ({
    BubbleMenu: (props: Record<string, unknown>) => {
        capturedProps = props;
        return null;
    },
}));

import { EditorBubbleMenu } from "@features/editor/bubble-menu/EditorBubbleMenu";

function makeFakeEditor(rect?: DOMRect) {
    if (rect) mockRect = rect;
    return {
        isActive: () => false,
        chain: () => ({
            focus: () => ({
                toggleBold: () => ({ run: () => {} }),
                toggleItalic: () => ({ run: () => {} }),
                toggleCode: () => ({ run: () => {} }),
            }),
        }),
        getAttributes: () => ({}),
        view: {
            state: fakeState,
            dom: document.createElement("div"),
        },
    } as unknown as Parameters<typeof EditorBubbleMenu>[0]["editor"];
}

describe("EditorBubbleMenu", () => {
    it("使用 fixed 策略、高 z-index、内部滚动容器，且滚动更新无延迟", () => {
        const fakeScrollTarget = document.createElement("div");
        render(
            <EditorBubbleMenu
                editor={makeFakeEditor()}
                scrollTarget={fakeScrollTarget}
                onInsertLink={() => {}}
            />,
        );

        expect(capturedProps).not.toBeNull();
        expect(capturedProps?.resizeDelay).toBe(0);

        const options = capturedProps?.options as Record<string, unknown> | undefined;
        expect(options?.strategy).toBe("fixed");
        expect(options?.scrollTarget).toBe(fakeScrollTarget);

        const className = capturedProps?.className as string | undefined;
        const zMatch = /\bz-(\d+)/.exec(className || "");
        expect(zMatch).not.toBeNull();
        expect(Number(zMatch?.[1])).toBeGreaterThan(10);
    });

    it("选择区在编辑器可视区内时 shouldShow 返回 true", () => {
        const container = document.createElement("div");
        container.getBoundingClientRect = () => new DOMRect(0, 100, 500, 300);
        // 选择区在容器内部
        const editor = makeFakeEditor(new DOMRect(50, 150, 100, 20));

        render(
            <EditorBubbleMenu editor={editor} scrollTarget={container} onInsertLink={() => {}} />,
        );

        const shouldShow = capturedProps?.shouldShow as ({
            state,
        }: {
            state: typeof fakeState;
        }) => boolean;
        expect(shouldShow({ state: fakeState })).toBe(true);
    });

    it("选择区滚出编辑器可视区时 shouldShow 返回 false", () => {
        const container = document.createElement("div");
        container.getBoundingClientRect = () => new DOMRect(0, 100, 500, 300);
        // 选择区在容器上方
        const editor = makeFakeEditor(new DOMRect(50, 50, 100, 20));

        render(
            <EditorBubbleMenu editor={editor} scrollTarget={container} onInsertLink={() => {}} />,
        );

        const shouldShow = capturedProps?.shouldShow as ({
            state,
        }: {
            state: typeof fakeState;
        }) => boolean;
        expect(shouldShow({ state: fakeState })).toBe(false);
    });
});
