/**
 * editor 模块统一导出
 *
 * RichTextEditor 是对外主组件，markdown-utils 提供导入导出工具函数。
 */

export { exportMarkdown, importMarkdownFile } from "./lib/markdown-utils";
export {
    RichTextEditor,
    type RichTextEditorHandle,
    type RichTextEditorProps,
} from "./RichTextEditor";
