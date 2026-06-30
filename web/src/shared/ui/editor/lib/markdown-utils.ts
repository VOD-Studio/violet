/**
 * markdown-utils - Markdown 导入导出工具
 *
 * 导入：读取 .md 文件文本 → 写入编辑器（由 Markdown 扩展解析为 ProseMirror 节点）。
 * 导出：取编辑器 Markdown 字符串 → 触发浏览器下载，文件名取文章 slug。
 */
import type { Editor } from "@tiptap/react";

/**
 * importMarkdownFile - 从本地 .md 文件导入内容到编辑器
 *
 * @param editor 目标编辑器实例
 * @param file 用户选择的 .md/.markdown/.txt 文件
 */
export function importMarkdownFile(editor: Editor, file: File): Promise<void> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const text = typeof reader.result === "string" ? reader.result : "";
            editor.commands.setContent(text, { contentType: "markdown" });
            resolve();
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

/**
 * exportMarkdown - 将编辑器内容导出为 .md 文件并下载
 *
 * @param editor 源编辑器实例
 * @param filename 文件名（不含扩展名），默认 "article"
 */
export function exportMarkdown(editor: Editor, filename = "article"): void {
    const md = editor.getMarkdown();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
