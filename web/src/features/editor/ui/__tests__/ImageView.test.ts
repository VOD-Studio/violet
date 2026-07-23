/**
 * ImageView 序列化保障测试。
 *
 * 编辑时 NodeView 显示 w=1200 缩略,但序列化(getHTML)必须输出原图 URL——
 * 若存库内容被缩略 URL 污染,预览层将永远无法还原原图。
 * 本测试用无头 Editor 验证该不变量。
 */
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { createImageExtension } from "../ImageView";

function createEditor(content: string) {
    return new Editor({
        element: document.createElement("div"),
        extensions: [
            StarterKit,
            createImageExtension().configure({
                inline: false,
                allowBase64: false,
                HTMLAttributes: { class: "rounded-lg" },
            }),
        ],
        content,
    });
}

describe("ImageView 序列化保障", () => {
    it("getHTML 输出原图 URL,不含缩略处理参数", () => {
        const editor = createEditor('<p><img src="/uploads/2026/07/a.jpg" alt="示例"></p>');

        const html = editor.getHTML();
        expect(html).toContain('src="/uploads/2026/07/a.jpg"');
        expect(html).not.toContain("w=1200");
        expect(html).not.toContain("format=webp");

        editor.destroy();
    });

    it("插入图片命令存 node.attrs.src 原图(显示层缩略不污染)", () => {
        const editor = createEditor("<p></p>");
        editor.chain().focus().setImage({ src: "/uploads/2026/07/b.png", alt: "新图" }).run();

        expect(editor.getHTML()).toContain('src="/uploads/2026/07/b.png"');

        editor.destroy();
    });
});
