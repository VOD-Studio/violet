/**
 * shouldShowBubbleMenu - 浮动工具栏显示条件
 *
 * 只服务于文本选区：空选区（光标态）、代码块内选区、全选、
 * 以及节点选中（NodeSelection：公式/图片等 atom 节点）都不显示。
 * 公式节点选中时由弹层编辑接管交互，浮动工具栏与之互斥。
 */
import type { EditorState } from "@tiptap/pm/state";
import { NodeSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";

export interface ShouldShowBubbleMenuOptions {
	editor: Editor;
	state: EditorState;
	from: number;
	to: number;
}

export function shouldShowBubbleMenu({ editor, state, from, to }: ShouldShowBubbleMenuOptions) {
	const { selection } = state;
	if (selection.empty) return false;
	// 节点选中（公式、图片等）不显示文本格式化工具栏
	if (selection instanceof NodeSelection) return false;
	if (editor.isActive("codeBlock")) return false;
	// 全选时不显示浮动菜单
	if (from === 0 && to === state.doc.content.size) return false;
	return true;
}
