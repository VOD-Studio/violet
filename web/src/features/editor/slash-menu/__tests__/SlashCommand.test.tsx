/**
 * SlashCommand 斜杠菜单挂载层叠回归测试
 *
 * 契约：slash 菜单 host 由 suggestion managed mount 挂到 document.body，
 * 必须带高于 Zen 专注根容器（fixed inset-0 z-40）的 z-index（50，项目
 * 弹窗惯例），否则专注模式下输入 / 菜单被 zen 容器整体遮挡。
 */
import { Editor } from "@tiptap/core";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildEditorExtensionsWithSlash } from "../../extensions";

beforeAll(() => {
	// jsdom 未实现 scrollIntoView，SlashMenuView 选中变化时会调用（同 SlashMenu.test 的桩）
	Element.prototype.scrollIntoView = vi.fn();
});

function createEditor(): Editor {
	return new Editor({
		element: document.createElement("div"),
		extensions: buildEditorExtensionsWithSlash(() => { }),
		content: "",
	});
}

/** v3 Suggestion 走 plugin apply 检查事务，普通插入即触发真实激活路径 */
function typeText(editor: Editor, text: string): void {
	editor.commands.insertContent(text);
}

describe("SlashCommand 挂载层叠", () => {
	it("输入 / 唤起菜单，host 挂在 body 且 z-index 高于 zen 容器（z-40）", async () => {
		const editor = createEditor();

		typeText(editor, "/");
		// plugin view 的 update 是 async 的，onStart 在 microtask 后才 dispatch
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 50);
		});

		const host = document.querySelector<HTMLElement>(".slash-menu-host");
		expect(host).toBeTruthy();
		// 遮挡前提：host 在 body 下、zen fixed 容器之外，无 z-index 即被压
		expect(host?.parentElement).toBe(document.body);
		expect(host?.style.zIndex).toBe("50");

		editor.destroy();
		expect(document.querySelector(".slash-menu-host")).toBeNull();
	});
});
