/**
 * MathView 编辑器数学公式测试
 *
 * 核心场景：
 * - markdown 导入 $..$ / $$..$$ 解析为数学节点，getHTML 产出语义化标记（浏览时渲染载体）；
 * - getMarkdown 回序列化为标准 $..$ / $$..$$（round-trip 无损）；
 * - 数学节点是 atom，不计入 editor.getText() 字数统计。
 */
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { buildEditorExtensions } from "../../extensions";

function createEditor(): Editor {
    return new Editor({
        element: document.createElement("div"),
        extensions: buildEditorExtensions(),
        content: "",
    });
}

describe("编辑器数学公式", () => {
    it("markdown 行内 $..$ 解析为 inlineMath，HTML 产出语义化 span", () => {
        const editor = createEditor();
        editor.commands.setContent("质能方程 $E=mc^2$ 著名", { contentType: "markdown" });
        const html = editor.getHTML();
        expect(html).toContain('data-type="inline-math"');
        expect(html).toContain('data-latex="E=mc^2"');
        editor.destroy();
    });

    it("markdown 块级 $$..$$ 解析为 blockMath，HTML 产出语义化 div", () => {
        const editor = createEditor();
        editor.commands.setContent("$$\\int_0^1 x\\,\\dd{x}$$", { contentType: "markdown" });
        const html = editor.getHTML();
        expect(html).toContain('data-type="block-math"');
        expect(html).toContain("data-latex=");
        editor.destroy();
    });

    it("getMarkdown 回序列化为标准 $..$（round-trip）", () => {
        const editor = createEditor();
        editor.commands.setContent("行内 $E=mc^2$ 测试", { contentType: "markdown" });
        expect(editor.getMarkdown()).toContain("$E=mc^2$");
        editor.destroy();
    });

    it("insertInlineMath / insertBlockMath 命令可用", () => {
        const editor = createEditor();
        editor.commands.insertInlineMath({ latex: "a^2+b^2=c^2" });
        expect(editor.getHTML()).toContain('data-type="inline-math"');
        editor.commands.insertBlockMath({ latex: "\\sum i" });
        expect(editor.getHTML()).toContain('data-type="block-math"');
        editor.destroy();
    });

    it("数学节点不计入字数统计（getText 不含 latex）", () => {
        const editor = createEditor();
        editor.commands.setContent("正文$E=mc^2$继续", { contentType: "markdown" });
        const text = editor.getText();
        expect(text).toContain("正文");
        expect(text).not.toContain("E=mc^2");
        editor.destroy();
    });
});
