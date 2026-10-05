import { createDocument, Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, TextSelection } from "@tiptap/pm/state";
import { Transform } from "@tiptap/pm/transform";
import { decodeFootnoteLabel, normalizeFootnotes } from "./footnote-state";

function labelFromElement(element: HTMLElement): string {
	const anchor = element.matches("a") ? element : element.querySelector("a");
	const explicit =
		element.getAttribute("data-footnote-label") ?? anchor?.getAttribute("data-footnote-label");
	if (explicit) return explicit;
	const target = element.matches("li")
		? element.id
		: (anchor?.getAttribute("href")?.replace(/^#/, "") ?? "");
	return decodeFootnoteLabel(target.replace(/^(?:user-content-)?fn[:-]/, ""));
}

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		footnotes: {
			/** 插入可编辑的新脚注，或引用已有标识对应的脚注。 */
			insertFootnote: (label?: string) => ReturnType;
		};
	}
}

/** 同标识引用共享正文；编号和出现次序由文档归一化维护。 */
export const FootnoteReference = Node.create({
	name: "footnoteReference",
	// Markdown 先把初始源码转为 JSON，再归一化完整文档。
	priority: -1,
	group: "inline",
	inline: true,
	atom: true,
	addAttributes() {
		return {
			label: { default: "", rendered: false, parseHTML: labelFromElement },
			number: { default: 1, rendered: false },
			occurrence: { default: 1, rendered: false },
		};
	},
	onBeforeCreate() {
		const document = createDocument(
			this.editor.options.content,
			this.editor.schema,
			this.editor.options.parseOptions,
		);
		const transform = new Transform(document);
		normalizeFootnotes(transform);
		if (transform.docChanged) this.editor.options.content = transform.doc.toJSON();
	},
	parseHTML() {
		return [
			{
				tag: "sup",
				priority: 100,
				getAttrs: (element) =>
					element.querySelector(
						'a[href^="#fn"], a[data-footnote-ref], a[role="doc-noteref"]',
					)
						? {}
						: false,
			},
			{ tag: "a[data-footnote-ref]", priority: 100 },
			{ tag: 'a[role="doc-noteref"]', priority: 100 },
		];
	},
	renderHTML({ node }) {
		const label = node.attrs.label as string;
		return [
			"sup",
			[
				"a",
				{
					id: `fnref-${encodeURIComponent(label)}-${node.attrs.occurrence}`,
					href: `#fn-${encodeURIComponent(label)}`,
					"data-footnote-ref": "",
					"data-footnote-label": label,
					role: "doc-noteref",
				},
				String(node.attrs.number),
			],
		];
	},
	markdownTokenizer: {
		name: "footnoteReference",
		level: "inline",
		start: (source) => source.indexOf("[^"),
		tokenize(source) {
			const match = /^\[\^([^\]\n]+)\]/.exec(source);
			return match
				? { type: "footnoteReference", raw: match[0], label: decodeFootnoteLabel(match[1]) }
				: undefined;
		},
	},
	parseMarkdown: (token) => ({ type: "footnoteReference", attrs: { label: token.label } }),
	renderMarkdown: (node) => `[^${encodeURIComponent(node.attrs?.label ?? "")}]`,
	addCommands() {
		return {
			insertFootnote:
				(existingLabel) =>
				({ tr, dispatch, state }) => {
					let listPosition = -1;
					let list: ProseMirrorNode | null = null;
					const labels = new Set<string>();
					state.doc.descendants((node, position) => {
						if (node.type.name === "footnotes") {
							list = node;
							listPosition = position;
						}
						if (node.type.name === "footnoteDefinition") labels.add(node.attrs.label);
					});
					if (existingLabel && !labels.has(existingLabel)) return false;
					let number = 1;
					while (labels.has(String(number))) number++;
					const label = existingLabel ?? String(number);
					if (!dispatch) return true;
					tr.replaceSelectionWith(state.schema.nodes.footnoteReference.create({ label }));
					if (!existingLabel) {
						const definition = state.schema.nodes.footnoteDefinition.create(
							{ label },
							state.schema.nodes.paragraph.create(),
						);
						const existingList = list as ProseMirrorNode | null;
						const position = existingList
							? tr.mapping.map(listPosition + existingList.nodeSize - 1)
							: tr.doc.content.size;
						tr.insert(
							position,
							existingList
								? definition
								: state.schema.nodes.footnotes.create(null, definition),
						);
						tr.setSelection(
							TextSelection.create(tr.doc, position + (existingList ? 2 : 3)),
						);
					}
					return true;
				},
		};
	},
	addProseMirrorPlugins() {
		return [
			new Plugin({
				appendTransaction(transactions, _oldState, state) {
					if (!transactions.some((transaction) => transaction.docChanged)) return null;
					const transaction = state.tr;
					normalizeFootnotes(transaction);
					return transaction.docChanged ? transaction : null;
				},
				props: {
					handleClickOn(view, _position, node, _nodePosition, _event, direct) {
						if (!direct || node.type.name !== "footnoteReference") return false;
						let destination = -1;
						view.state.doc.descendants((child, position) => {
							if (
								child.type.name === "footnoteDefinition" &&
								child.attrs.label === node.attrs.label
							)
								destination = position + 2;
						});
						if (destination < 0) return false;
						view.dispatch(
							view.state.tr
								.setSelection(
									TextSelection.near(view.state.doc.resolve(destination)),
								)
								.scrollIntoView(),
						);
						view.focus();
						return true;
					},
				},
			}),
		];
	},
});

/** 脚注正文保持可编辑富文本，生成的回链不混入正文内容。 */
export const FootnoteDefinition = Node.create({
	name: "footnoteDefinition",
	content: "block+",
	defining: true,
	addAttributes() {
		return {
			label: { default: "", rendered: false, parseHTML: labelFromElement },
			referenceCount: { default: 0, rendered: false },
			number: { default: 0, rendered: false },
		};
	},
	parseHTML() {
		return [
			{
				tag: 'li[data-footnote-label], li[id^="fn:"], li[id^="fn-"], li[id^="user-content-fn-"]',
				priority: 100,
				contentElement: (element) => {
					const content = element.cloneNode(true) as HTMLElement;
					content
						.querySelectorAll(
							'a[data-footnote-backref], a[role="doc-backlink"], a[href^="#fnref"], a[href^="#user-content-fnref"]',
						)
						.forEach((link) => {
							for (const adjacent of [link.previousSibling, link.nextSibling]) {
								if (adjacent?.nodeType === 3 && !adjacent.textContent?.trim())
									adjacent.remove();
							}
							link.remove();
						});
					return content;
				},
			},
		];
	},
	renderHTML({ node }) {
		const label = node.attrs.label as string;
		const links = Array.from(
			{ length: node.attrs.referenceCount as number },
			(_, index) =>
				[
					"a",
					{
						href: `#fnref-${encodeURIComponent(label)}-${index + 1}`,
						"data-footnote-backref": "",
						role: "doc-backlink",
						"aria-label": `返回脚注引用 ${index + 1}`,
						contenteditable: "false",
					},
					`↩${index ? index + 1 : ""}`,
				] as const,
		);
		return [
			"li",
			{
				id: `fn-${encodeURIComponent(label)}`,
				"data-footnote-label": label,
				value: node.attrs.number || undefined,
			},
			["div", 0],
			...links,
		];
	},
	renderMarkdown(node, helpers) {
		const content = helpers.renderChildren(node.content ?? [], "\n\n").trim();
		return `[^${encodeURIComponent(node.attrs?.label ?? "")}]: ${content.replace(/\n/g, "\n    ")}`;
	},
});
