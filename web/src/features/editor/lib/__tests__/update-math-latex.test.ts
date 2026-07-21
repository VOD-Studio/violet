/**
 * updateMathLatex 回归测试
 *
 * 回归场景：行内公式在弹层中输入时，每次击键都会更新 latex。
 * 裸 setNodeMarkup 会让行内节点的 NodeSelection 降级成 TextSelection，
 * 弹层依赖的 selected 变 false 导致一输入就关闭；块级节点原本不受影响。
 */
import { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";
import { buildEditorExtensions } from "../../extensions";
import { updateMathLatex } from "../update-math-latex";

function createEditor(content: string): Editor {
    const editor = new Editor({
        element: document.createElement("div"),
        extensions: buildEditorExtensions(),
        content: "",
    });
    editor.commands.setContent(content, { contentType: "markdown" });
    return editor;
}

function findNodePos(editor: Editor, type: string): number {
    let found = -1;
    editor.state.doc.descendants((node, pos) => {
        if (node.type.name === type) {
            found = pos;
            return false;
        }
        return true;
    });
    return found;
}

function applyLatex(editor: Editor, pos: number, latex: string): void {
    editor.commands.command(({ tr }) => {
        updateMathLatex(tr, pos, latex);
        return true;
    });
}

describe("updateMathLatex", () => {
    it("行内公式：更新 latex 后保持 NodeSelection 选中该节点", () => {
        const editor = createEditor("公式 $E=mc^2$ 测试");
        const pos = findNodePos(editor, "inlineMath");
        editor.commands.setNodeSelection(pos);

        applyLatex(editor, pos, "E=mc^3");

        const sel = editor.state.selection;
        expect(sel).toBeInstanceOf(NodeSelection);
        expect((sel as NodeSelection).node.type.name).toBe("inlineMath");
        expect((sel as NodeSelection).node.attrs.latex).toBe("E=mc^3");
        editor.destroy();
    });

    it("块级公式：更新 latex 后保持 NodeSelection 选中该节点", () => {
        const editor = createEditor("$$E=mc^2$$");
        const pos = findNodePos(editor, "blockMath");
        editor.commands.setNodeSelection(pos);

        applyLatex(editor, pos, "\\int_0^1 x\\,dx");

        const sel = editor.state.selection;
        expect(sel).toBeInstanceOf(NodeSelection);
        expect((sel as NodeSelection).node.type.name).toBe("blockMath");
        expect((sel as NodeSelection).node.attrs.latex).toBe("\\int_0^1 x\\,dx");
        editor.destroy();
    });
});
