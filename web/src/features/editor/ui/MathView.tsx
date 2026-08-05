/**
 * MathView - 数学公式扩展对（NodeView 装配入口）
 *
 * 行内/块级公式共用 MathPopoverView（弹层编辑，ADR-0005），
 * 这里只做 displayMode 适配与扩展配置。宏表与渲染核心走
 * shared/ui/katex，与阅读端同源；输入规则（$ / $$ 自动转换）由官方扩展自带。
 */
import { BlockMath, InlineMath } from "@tiptap/extension-mathematics";
import type { NodeViewProps } from "@tiptap/react";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { KATEX_OPTIONS } from "@/shared/ui/katex";
import { MathPopoverView } from "./MathPopoverView";

/** 行内公式 NodeView 渲染适配器（displayMode=false） */
const renderInlineMathView = (props: NodeViewProps) => (
	<MathPopoverView {...props} displayMode={false} />
);

/** 公式块 NodeView 渲染适配器（displayMode=true） */
const renderBlockMathView = (props: NodeViewProps) => (
	<MathPopoverView {...props} displayMode={true} />
);

export function createMathExtensions() {
	return [
		InlineMath.extend({
			addNodeView() {
				return ReactNodeViewRenderer(renderInlineMathView);
			},
		}).configure({ katexOptions: KATEX_OPTIONS }),
		BlockMath.extend({
			addNodeView() {
				return ReactNodeViewRenderer(renderBlockMathView);
			},
		}).configure({ katexOptions: KATEX_OPTIONS }),
	];
}
