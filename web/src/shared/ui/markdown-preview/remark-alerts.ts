import type { Blockquote, Nodes, Root } from "mdast";
import type { Transformer } from "unified";

function transformAlert(node: Blockquote, source: string) {
	const paragraph = node.children[0];
	if (paragraph?.type !== "paragraph") return;
	const first = paragraph.children[0];
	if (first?.type !== "text") return;
	const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][\t ]*(?:\r?\n|$)/u.exec(first.value);
	if (!match) return;
	const offset = first.position?.start.offset;
	// mdast 已解码转义和字符引用；只接受源码中逐字写出的 marker。
	if (
		offset === undefined ||
		!/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][\t ]*(?:\r?\n|$)/u.test(source.slice(offset))
	)
		return;

	node.data = {
		...node.data,
		hProperties: { ...node.data?.hProperties, dataType: "alert", dataAlertType: match[1] },
	};
	first.value = first.value.slice(match[0].length);
	if (!first.value) {
		paragraph.children.shift();
		if (paragraph.children[0]?.type === "break") paragraph.children.shift();
	}
	if (!paragraph.children.length) node.children.shift();
}

/** 只转换引用节点首行的 GitHub 提示标记，保留其余块结构。 */
export function remarkAlerts(): Transformer<Root> {
	return (tree, file) => {
		const source = String(file);
		const visit = (node: Nodes) => {
			if (node.type === "blockquote") transformAlert(node, source);
			if ("children" in node) for (const child of node.children) visit(child);
		};
		visit(tree);
	};
}
