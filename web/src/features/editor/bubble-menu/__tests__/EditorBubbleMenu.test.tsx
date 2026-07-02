/**
 * EditorBubbleMenu 回归测试
 *
 * 核心场景：选中文本后的浮动工具条必须：
 * - 使用 fixed 定位策略，避免被 EditorToolbar 遮挡，并能在编辑器滚动时随选区更新位置；
 * - 有高于 EditorToolbar（z-10）的 z-index。
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let capturedProps: Record<string, unknown> | null = null;

vi.mock("@tiptap/react/menus", () => ({
    BubbleMenu: (props: Record<string, unknown>) => {
        capturedProps = props;
        return null;
    },
}));

import { EditorBubbleMenu } from "@features/editor/bubble-menu/EditorBubbleMenu";

const fakeEditor = {
    isActive: () => false,
    chain: () => ({
        focus: () => ({
            toggleBold: () => ({ run: () => {} }),
            toggleItalic: () => ({ run: () => {} }),
            toggleCode: () => ({ run: () => {} }),
        }),
    }),
    getAttributes: () => ({}),
} as unknown as Parameters<typeof EditorBubbleMenu>[0]["editor"];

describe("EditorBubbleMenu", () => {
    it("使用 fixed 定位策略、高于工具栏的 z-index，并传入内部滚动容器", () => {
        const fakeScrollTarget = document.createElement("div");
        render(
            <EditorBubbleMenu
                editor={fakeEditor}
                scrollTarget={fakeScrollTarget}
                onInsertLink={() => {}}
            />,
        );

        expect(capturedProps).not.toBeNull();
        const options = capturedProps?.options as Record<string, unknown> | undefined;
        expect(options?.strategy).toBe("fixed");
        expect(options?.scrollTarget).toBe(fakeScrollTarget);

        const className = capturedProps?.className as string | undefined;
        expect(className).toMatch(/\bz-\d+/);
        // EditorToolbar 是 z-10，bubble menu 必须更高
        const zMatch = /\bz-(\d+)/.exec(className || "");
        expect(zMatch).not.toBeNull();
        expect(Number(zMatch?.[1])).toBeGreaterThan(10);
    });
});
