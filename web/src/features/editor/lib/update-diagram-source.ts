/**
 * updateDiagramSource - 在同一事务内更新图块 source 并保持节点选中
 *
 * 复刻 update-math-latex 的同事务重建 NodeSelection 模式：diagramBlock 是 atom
 * 节点，setNodeMarkup 改属性后必须 tr.setSelection(NodeSelection.create) 把选区
 * 显式钉回该节点，否则 NodeView 的 selected 下降 → 弹层误关（ADR-0005 弹层开闭
 * 契约）。块级 atom 实测不受 setNodeMarkup 降级影响，但显式重建是廉价保险，且与
 * 已验证的公式弹层保持同一套写法。
 *
 * source 不进 contentEditable（atom 节点），所有更新都经此 helper 走事务。
 */
import { NodeSelection, type Transaction } from "@tiptap/pm/state";

/**
 * 在事务 tr 内把 pos 处图块节点的 source 更新为新值，并将选区重置回该节点。
 * pos 处无节点时不做任何改动。
 */
export function updateDiagramSource(tr: Transaction, pos: number, source: string): void {
	const node = tr.doc.nodeAt(pos);
	if (!node) return;
	tr.setNodeMarkup(pos, undefined, { ...node.attrs, source });
	tr.setSelection(NodeSelection.create(tr.doc, pos));
}
