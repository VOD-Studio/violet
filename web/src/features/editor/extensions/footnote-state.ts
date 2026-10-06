import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Transform } from "@tiptap/pm/transform";

/** 还原脚注标识的 URL 转义；外部 HTML 的字面百分号保持原样。 */
export function decodeFootnoteLabel(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

/** 将脚注定义归并到文末，并把编号、出现次序和回链数写入节点，供静态序列化和视图共用。 */
export function normalizeFootnotes(transform: Transform): void {
	const numbers = new Map<string, number>();
	const counts = new Map<string, number>();
	const references: {
		node: ProseMirrorNode;
		position: number;
		number: number;
		occurrence: number;
	}[] = [];
	transform.doc.descendants((node, position) => {
		if (node.type.name !== "footnoteReference") return;
		const label = node.attrs.label as string;
		const number = numbers.get(label) ?? numbers.size + 1;
		const occurrence = (counts.get(label) ?? 0) + 1;
		numbers.set(label, number);
		counts.set(label, occurrence);
		references.push({ node, position, number, occurrence });
	});
	for (const { node, position, number, occurrence } of references) {
		if (node.attrs.number !== number || node.attrs.occurrence !== occurrence) {
			transform.setNodeMarkup(position, undefined, { ...node.attrs, number, occurrence });
		}
	}
	transform.doc.descendants((node, position) => {
		if (node.type.name !== "footnoteDefinition") return;
		const referenceCount = counts.get(node.attrs.label) ?? 0;
		const number = numbers.get(node.attrs.label) ?? 0;
		if (node.attrs.referenceCount !== referenceCount || node.attrs.number !== number) {
			transform.setNodeMarkup(position, undefined, { ...node.attrs, referenceCount, number });
		}
	});
	const lists: { node: ProseMirrorNode; position: number }[] = [];
	const definitions: ProseMirrorNode[] = [];
	transform.doc.forEach((node, position) => {
		if (node.type.name !== "footnotes") return;
		lists.push({ node, position });
		node.forEach((definition) => {
			definitions.push(definition);
		});
	});
	if (!lists.length) return;
	const list = transform.doc.type.schema.nodes.footnotes.create(null, definitions);
	if (lists.length === 1 && transform.doc.lastChild === lists[0].node && list.eq(lists[0].node))
		return;
	for (const { node, position } of lists.reverse())
		transform.delete(position, position + node.nodeSize);
	transform.insert(transform.doc.content.size, list);
}
