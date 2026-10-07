import type { JSONContent } from "@tiptap/core";
import { Table } from "@tiptap/extension-table";
import type { Schema } from "@tiptap/pm/model";
import { requiresNativeHtml, serializeNativeHtml } from "./native-syntax";

/** 转义 GFM 单元格分隔符；无法表达的结构保留为 schema 序列化的 HTML 表格。 */
export function createMarkdownTable() {
	let schema: Schema;
	return Table.extend({
		onBeforeCreate() {
			schema = this.editor.schema;
		},
		renderMarkdown(node, helpers) {
			if (requiresNativeHtml(node)) return serializeNativeHtml(node, schema);
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
