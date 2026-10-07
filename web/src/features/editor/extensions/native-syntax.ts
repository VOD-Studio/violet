import { getExtensionField, type JSONContent, Node, type NodeConfig } from "@tiptap/core";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { DOMParser, DOMSerializer, type Schema } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";

/** 使用单行 HTML carrier，避免 CommonMark 在代码空行处提前结束 HTML block。 */
export function serializeNativeHtml(node: JSONContent, schema: Schema): string {
	const container = document.createElement("div");
	const content = schema.nodeFromJSON(node);
	const serializer = DOMSerializer.fromSchema(schema);
	container.append(
		content.type === schema.topNodeType
			? serializer.serializeFragment(content.content)
			: serializer.serializeNode(content),
	);
	const html = content.type === schema.topNodeType ? container.outerHTML : container.innerHTML;
	return html.replace(/\r/g, "&#13;").replace(/\n/g, "&#10;");
}

/** 与各节点的 Markdown 序列化共用原生 HTML 载体判定。 */
export function requiresNativeHtml(node: JSONContent): boolean {
	if (node.type === "details") return true;
	if (node.type === "paragraph" || node.type === "heading") {
		return (
			node.content?.some((child) =>
				child.marks?.some(
					(mark) => mark.type === "subscript" || mark.type === "superscript",
				),
			) ?? false
		);
	}
	if (node.type !== "table") return false;
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
				return (
					requiresNativeHtml(cell.content[0]) ||
					cell.content[0].content?.some(
						(inline) =>
							inline.type === "hardBreak" ||
							(inline.marks?.some((mark) => mark.type === "code") &&
								inline.text?.includes("\\") &&
								inline.text.includes("|")),
					)
				);
			}),
	);
}

function hasCarrierFootnote(node: JSONContent, insideCarrier = false): boolean {
	const carrier = insideCarrier || requiresNativeHtml(node);
	if (carrier && node.type === "footnoteReference") return true;
	return node.content?.some((child) => hasCarrierFootnote(child, carrier)) ?? false;
}

/** 上下标与其他格式交错时，整个文本块使用 HTML 保留字符转义与格式边界。 */
export function createNativeSyntaxStarterKit() {
	let schema: Schema;
	return StarterKit.extend({
		onBeforeCreate() {
			schema = this.editor.schema;
		},
		addExtensions() {
			return (this.parent?.() ?? []).map((extension) => {
				if (
					!(extension instanceof Node) ||
					!["doc", "paragraph", "heading"].includes(extension.name)
				)
					return extension;
				const renderMarkdown = getExtensionField<NonNullable<NodeConfig["renderMarkdown"]>>(
					extension,
					"renderMarkdown",
				);
				return extension.extend({
					renderMarkdown(node, helpers, context) {
						// HTML 内的 href 不会触发 Markdown 脚注定义；混用会丢定义或拆开重复引用的编号。
						if (
							(node.type === "doc" && hasCarrierFootnote(node)) ||
							requiresNativeHtml(node)
						) {
							return serializeNativeHtml(node, schema);
						}
						return renderMarkdown(node, helpers, context);
					},
				});
			});
		},
	});
}

/** 官方上下标命令与快捷键；排斥另一种 mark，且不增加波浪号/尖号方言。 */
export const NativeSubscript = Subscript.extend({ excludes: "superscript" });
export const NativeSuperscript = Superscript.extend({ excludes: "subscript" });

/** 官方折叠块交互，保存作者的 open 状态，并接受没有内部 div 的原生 HTML。 */
export function createNativeDetails() {
	let schema: Schema;
	const details = Node.create({
		...Details.config,
		onBeforeCreate() {
			schema = this.editor.schema;
		},
		parseHTML() {
			return [
				{
					tag: "details",
					getContent(element, currentSchema) {
						const container = document.createElement("div");
						const summary = (element as HTMLElement).querySelector(":scope > summary");
						container.append(
							summary?.cloneNode(true) ?? document.createElement("summary"),
						);
						const content = document.createElement("div");
						content.dataset.type = "detailsContent";
						for (const child of element.childNodes) {
							if (child === summary) continue;
							if (
								child instanceof HTMLElement &&
								child.matches('div[data-type="detailsContent"]')
							) {
								for (const nested of child.childNodes)
									content.append(nested.cloneNode(true));
							} else {
								content.append(child.cloneNode(true));
							}
						}
						container.append(content);
						return DOMParser.fromSchema(currentSchema).parseSlice(container).content;
					},
				},
			];
		},
		// 仅使用原生 HTML 载体，不注册官方的 :::details 方言。
		markdownTokenizer: undefined,
		parseMarkdown: undefined,
		renderMarkdown(node) {
			return serializeNativeHtml(node, schema);
		},
	}).configure({
		persist: true,
		renderToggleButton: ({ element, isOpen }) => {
			element.textContent = isOpen ? "−" : "+";
			element.setAttribute(
				"aria-label",
				isOpen ? "收起折叠内容（默认收起）" : "展开折叠内容（默认展开）",
			);
			element.setAttribute("aria-expanded", String(isOpen));
		},
	});
	return [
		details,
		Node.create({
			...DetailsSummary.config,
			content: "inline*",
			markdownTokenizer: undefined,
			parseMarkdown: undefined,
		}),
		Node.create({
			...DetailsContent.config,
			markdownTokenizer: undefined,
			parseMarkdown: undefined,
		}),
	];
}
