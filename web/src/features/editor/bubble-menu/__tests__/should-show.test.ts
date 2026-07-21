/**
 * shouldShowBubbleMenu 测试
 *
 * 契约：浮动工具栏只服务于文本选区——
 * 空选区、代码块、全选、节点选中（公式/图片等 NodeSelection）都不显示。
 */
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { buildEditorExtensions } from "../../extensions";
import { shouldShowBubbleMenu } from "../should-show";

function createEditor(content = ""): Editor {
    return new Editor({
        element: document.createElement("div"),
        extensions: buildEditorExtensions(),
        content,
    });
}

describe("shouldShowBubbleMenu", () => {
    it("普通文本选区显示", () => {
        const editor = createEditor();
        editor.commands.setContent("一段普通文本", { contentType: "markdown" });
        editor.commands.setTextSelection({ from: 1, to: 3 });
        const { state } = editor;
        expect(
            shouldShowBubbleMenu({
                editor,
                state,
                from: state.selection.from,
                to: state.selection.to,
            }),
        ).toBe(true);
        editor.destroy();
    });

    it("公式节点选中（NodeSelection）不显示", () => {
        const editor = createEditor();
        editor.commands.setContent("公式 $E=mc^2$ 测试", { contentType: "markdown" });
        // 定位 inlineMath 节点并 NodeSelection
        let mathPos = -1;
        editor.state.doc.descendants((node, pos) => {
            if (node.type.name === "inlineMath") {
                mathPos = pos;
                return false;
            }
            return true;
        });
        expect(mathPos).toBeGreaterThanOrEqual(0);
        editor.commands.setNodeSelection(mathPos);
        const { state } = editor;
        expect(
            shouldShowBubbleMenu({
                editor,
                state,
                from: state.selection.from,
                to: state.selection.to,
            }),
        ).toBe(false);
        editor.destroy();
    });

    it("空选区（光标态）不显示", () => {
        const editor = createEditor();
        editor.commands.setContent("文本", { contentType: "markdown" });
        editor.commands.setTextSelection(1);
        const { state } = editor;
        expect(
            shouldShowBubbleMenu({
                editor,
                state,
                from: state.selection.from,
                to: state.selection.to,
            }),
        ).toBe(false);
        editor.destroy();
    });

    it("代码块内选区不显示", () => {
        const editor = createEditor();
        editor.commands.setContent("```go\nfmt.Println()\n```", { contentType: "markdown" });
        editor.commands.setTextSelection({ from: 2, to: 4 });
        const { state } = editor;
        expect(
            shouldShowBubbleMenu({
                editor,
                state,
                from: state.selection.from,
                to: state.selection.to,
            }),
        ).toBe(false);
        editor.destroy();
    });

    it("全选不显示", () => {
        const editor = createEditor();
        editor.commands.setContent("短文本", { contentType: "markdown" });
        editor.commands.selectAll();
        const { state } = editor;
        expect(
            shouldShowBubbleMenu({
                editor,
                state,
                from: state.selection.from,
                to: state.selection.to,
            }),
        ).toBe(false);
        editor.destroy();
    });
});
