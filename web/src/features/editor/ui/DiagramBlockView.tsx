/**
 * DiagramBlockView - 图块（流程图）编辑器节点定义
 *
 * 独立 atom 节点 diagramBlock，携带 format（默认 mermaid）+ source 两个属性，
 * 打通 ```mermaid 围栏块的双向 Markdown 序列化与 slash 菜单插入。
 *
 * 围栏解析统一使用 marked 的 code token，由代码块扩展按语言分派到本节点。
 *
 * diagramBlock 是独立 atom（不复用 codeBlock 分流）：source 不进 contentEditable，
 * 避免 mermaid 源被自由编辑破坏语法；编辑交互走弹层（ADR-0005）。
 *
 * createDiagramBlockExtension 是装配入口（参照 createMathExtensions / createCodeBlockExtension）：
 * 在本节点定义上 .extend({ addNodeView() {...} }) 接入 DiagramPopoverView，复用数学公式
 * 已验证的浮层基础设施（@floating-ui/dom absolute + portal 进滚动容器 + Esc/外部点击关闭）。
 * 渲染核心与阅读端共用 shared/ui/diagram（renderMermaid + DOMPurify 双重防线）。
 */
import { mergeAttributes, Node } from "@tiptap/core";
import type { NodeViewProps } from "@tiptap/react";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { renderCodeFence } from "../extensions/code-fence";
import { DiagramPopoverView } from "./DiagramPopoverView";

/**
 * DiagramBlock 节点：atom 块，source 不进 contentEditable。
 *
 * 节点载体 HTML：<div data-type="diagram-block" data-format="mermaid" data-source="<转义后源码>">
 * data-source 由 ProseMirror 在序列化时自动 HTML 转义，阅读端无损提取。
 */
export const DiagramBlock = Node.create({
	name: "diagramBlock",
	group: "block",
	atom: true,

	addAttributes() {
		return {
			format: {
				default: "mermaid",
				parseHTML: (element) => element.getAttribute("data-format"),
				renderHTML: (attributes) => ({ "data-format": attributes.format }),
			},
			source: {
				default: "",
				parseHTML: (element) => element.getAttribute("data-source"),
				renderHTML: (attributes) => ({ "data-source": attributes.source }),
			},
		};
	},

	parseHTML() {
		return [{ tag: 'div[data-type="diagram-block"]' }];
	},

	renderHTML({ HTMLAttributes }) {
		return ["div", mergeAttributes(HTMLAttributes, { "data-type": "diagram-block" })];
	},

	renderMarkdown: (node) =>
		renderCodeFence(node.attrs?.source ?? "", node.attrs?.format ?? "mermaid"),
});

/** 图块 NodeView 渲染适配器（diagramBlock 永远是块级，单一适配器即可） */
const renderDiagramView = (props: NodeViewProps) => <DiagramPopoverView {...props} />;

/**
 * createDiagramBlockExtension - 图块扩展装配工厂
 *
 * 在 DiagramBlock 节点定义上挂 React NodeView（DiagramPopoverView：文档内渲染 +
 * 弹层编辑）。schema / parseHTML / renderHTML / markdown 四件套继承自 DiagramBlock，
 * 仅追加 NodeView。参照 createMathExtensions / createCodeBlockExtension 的工厂形态。
 */
export function createDiagramBlockExtension() {
	return DiagramBlock.extend({
		addNodeView() {
			return ReactNodeViewRenderer(renderDiagramView);
		},
	});
}
