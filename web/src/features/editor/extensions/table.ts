import type { JSONContent } from "@tiptap/core";
import { Table } from "@tiptap/extension-table";
import { DOMSerializer, type Schema } from "@tiptap/pm/model";

function requiresHtml(node: JSONContent): boolean {
	const rows = node.content ?? [];
	const width = rows[0]?.content?.length ?? 0;
	return rows.some(
		(row, rowIndex) =>
			row.content?.length !== width ||
			row.content.some((cell, column) => {
				if ((cell.attrs?.colspan ?? 1) !== 1 || (cell.attrs?.rowspan ?? 1) !== 1)
					return true;
				if (cell.type !== (rowIndex === 0 ? "tableHeader" : "tableCell")) return true;
				if (cell.attrs?.align !== rows[0]?.content?.[column]?.attrs?.align) return true;
				if (cell.content?.length !== 1 || cell.content[0].type !== "paragraph") return true;
				return cell.content[0].content?.some(
					(inline) =>
						inline.type === "hardBreak" ||
						(inline.marks?.some((mark) => mark.type === "code") &&
							inline.text?.includes("\\") &&
							inline.text.includes("|")),
				);
			}),
	);
}

/** 转义 GFM 单元格分隔符；无法表达的结构保留为 schema 序列化的 HTML 表格。 */
export function createMarkdownTable() {
	let schema: Schema;
	return Table.extend({
		onBeforeCreate() {
			schema = this.editor.schema;
		},
		renderMarkdown(node, helpers) {
			if (requiresHtml(node)) {
				const container = document.createElement("div");
				container.append(
					DOMSerializer.fromSchema(schema).serializeNode(schema.nodeFromJSON(node)),
				);
				return container.innerHTML;
			}
			const rows = node.content ?? [];
			if (!rows.length) return "";
			const renderRow = (row: JSONContent) =>
				`| ${(row.content ?? [])
					.map((cell) =>
						helpers
							.renderChildren(cell.content ?? [])
							.replace(/\|/g, "\\|")
							.trim(),
					)
					.join(" | ")} |`;
			const separator = `| ${(rows[0].content ?? [])
				.map((cell) => {
					switch (cell.attrs?.align) {
						case "left":
							return ":---";
						case "center":
							return ":---:";
						case "right":
							return "---:";
						default:
							return "---";
					}
				})
				.join(" | ")} |`;
			return [renderRow(rows[0]), separator, ...rows.slice(1).map(renderRow)].join("\n");
		},
	});
}
