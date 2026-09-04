/**
 * editor 模块统一导出
 *
 * RichTextEditor 是对外主组件，markdown-utils 提供导入导出工具函数，
 * EditorFeature/disabledFeatures 是能力裁剪的对外契约。
 */

export type { EditorFeature, ResolvedFeatures } from "./lib/features";
export { resolveFeatures } from "./lib/features";
export { exportMarkdown, importMarkdownFile } from "./lib/markdown-utils";
export {
	type ImportUrlMeta,
	type ImportUrlOpts,
	type ImportUrlResult,
	RichTextEditor,
	type RichTextEditorHandle,
	type RichTextEditorProps,
} from "./RichTextEditor";
