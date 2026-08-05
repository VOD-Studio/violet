/**
 * EditorBubbleMenu 回归测试
 *
 * 核心场景：选中文本后的浮动工具条必须：
 * - 使用绝对定位，被编辑器滚动容器的 overflow 裁剪，避免飘到工具栏上方；
 * - 有高于 EditorToolbar（z-10）的 z-index；
 * - 监听编辑器内部滚动容器，滚动时无延迟跟随。
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
	it("使用绝对定位、高 z-index、内部滚动容器，且滚动更新无延迟", () => {
		const fakeScrollTarget = document.createElement("div");
		render(
			<EditorBubbleMenu
				editor={fakeEditor}
				scrollTarget={fakeScrollTarget}
				onInsertLink={() => {}}
			/>,
		);

		expect(capturedProps).not.toBeNull();
		expect(capturedProps?.resizeDelay).toBe(0);

		const options = capturedProps?.options as Record<string, unknown> | undefined;
		// 不指定 strategy，使用插件默认的 absolute，使菜单受编辑器滚动容器 overflow 裁剪
		expect(options?.strategy).not.toBe("fixed");
		expect(options?.scrollTarget).toBe(fakeScrollTarget);

		const className = capturedProps?.className as string | undefined;
		const zMatch = /\bz-(\d+)/.exec(className || "");
		expect(zMatch).not.toBeNull();
		expect(Number(zMatch?.[1])).toBeGreaterThan(10);
	});
});
