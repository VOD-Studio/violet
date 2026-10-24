import type { ReactElement, ReactNode } from "react";

/**
 * 提取正文节点中的原始文字，供标题锚点、代码与可运行代码共用。
 *
 * @param node - 字符串、数字、节点数组或带 children 的 React 元素；不执行组件函数。
 * @returns 按原顺序拼接的文字；空节点和布尔值不产生内容，不主动裁剪空白。
 */
export function nodeToText(node: ReactNode): string {
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(nodeToText).join("");
	if (node && typeof node === "object" && "props" in node) {
		return nodeToText((node as ReactElement<{ children?: ReactNode }>).props.children);
	}
	return "";
}
