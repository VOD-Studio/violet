import type { EditorFeature } from "@features/editor";

/**
 * 笔记编辑器禁用的能力清单：
 * Markdown 忠实往返优先——color/align/underline 无原生语法，存回丢语义；
 * 图片走粘贴/拖拽直传（裁掉素材库下拉）；导入导出与链接采集是文章工作流。
 * 表格/公式/图表保留：技术笔记核心。
 */
export const NOTE_EDITOR_DISABLED: readonly EditorFeature[] = [
	"color",
	"align",
	"underline",
	"imageLibrary",
	"importFile",
	"exportFile",
];
