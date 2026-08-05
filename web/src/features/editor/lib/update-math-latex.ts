/**
 * updateMathLatex - 在同一事务内更新公式 latex 并保持节点选中
 *
 * 背景：PM 的 setNodeMarkup 作用于行内节点时，会把覆盖该节点的 NodeSelection
 * 降级成 TextSelection（块级节点不受影响），而弹层开闭依赖 NodeView 的 selected，
 * 表现为「行内公式一输入内容弹层就关闭」。同事务重建 NodeSelection 规避该行为。
 */
import { NodeSelection, type Transaction } from "@tiptap/pm/state";

/**
 * 在事务 tr 内把 pos 处公式节点的 latex 更新为新值，并将选区重置回该节点。
 * pos 处无节点时不做任何改动。
 */
export function updateMathLatex(tr: Transaction, pos: number, latex: string): void {
	const node = tr.doc.nodeAt(pos);
	if (!node) return;
	tr.setNodeMarkup(pos, undefined, { ...node.attrs, latex });
	tr.setSelection(NodeSelection.create(tr.doc, pos));
}
