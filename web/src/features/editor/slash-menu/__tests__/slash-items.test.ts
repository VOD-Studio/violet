/**
 * slash-items 公式项回归测试
 *
 * 锁定 slash 菜单插入公式的行为契约：
 * - 官方 insertInlineMath/insertBlockMath 对空 latex 返回 false，
 *   级联 setNodeSelection 在无节点位置抛 TypeError（曾导致 slash 插入无反应）；
 * - 现改用 insertContentAt 插入空节点，插入后节点处于 NodeSelection
 *   （弹层编辑随选中自动打开）。
 */
import { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { buildEditorExtensions } from "../../extensions";
import { buildSlashItems } from "../slash-items";

function createEditor(): Editor {
	return new Editor({
		element: document.createElement("div"),
		extensions: buildEditorExtensions(),
		content: "",
	});
}

function slashCommand(id: string) {
	const item = buildSlashItems(() => {}).find((i) => i.id === id);
	if (!item) throw new Error(`无此 slash 项: ${id}`);
	return item.command;
}

describe("slash 公式项", () => {
	it("行内公式：插入空节点并置于 NodeSelection", () => {
		const editor = createEditor();
		expect(() => slashCommand("inlineMath")(editor)).not.toThrow();
		expect(editor.getHTML()).toContain('data-type="inline-math"');
		const selection = editor.state.selection;
		expect(selection).toBeInstanceOf(NodeSelection);
		expect((selection as NodeSelection).node.type.name).toBe("inlineMath");
		editor.destroy();
	});

	it("公式块：插入空节点并置于 NodeSelection", () => {
		const editor = createEditor();
		expect(() => slashCommand("blockMath")(editor)).not.toThrow();
		expect(editor.getHTML()).toContain('data-type="block-math"');
		const selection = editor.state.selection;
		expect(selection).toBeInstanceOf(NodeSelection);
		expect((selection as NodeSelection).node.type.name).toBe("blockMath");
		editor.destroy();
	});

	it("公式块插入到非空段落中间也能选中", () => {
		const editor = createEditor();
		editor.commands.setContent("前文段落", { contentType: "markdown" });
		editor.commands.focus("end");
		expect(() => slashCommand("blockMath")(editor)).not.toThrow();
		const selection = editor.state.selection;
		expect(selection).toBeInstanceOf(NodeSelection);
		expect((selection as NodeSelection).node.type.name).toBe("blockMath");
		editor.destroy();
	});
});
