import { Extension, Mark } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const quotePresentationKey = new PluginKey<DecorationSet>("quotePresentation");

function quoteDecorations(doc: ProseMirrorNode): DecorationSet {
	const decorations: Decoration[] = [];
	doc.descendants((node, position) => {
		if (node.type.name !== "blockquote") {
			return;
		}
		decorations.push(
			Decoration.widget(
				position + 1,
				(view) => {
					const mark = view.dom.ownerDocument.createElement("span");
					mark.className = "article-blockquote-mark";
					mark.setAttribute("aria-hidden", "true");
					mark.contentEditable = "false";
					return mark;
				},
				{ key: `quote-mark:${position}`, side: -1, ignoreSelection: true },
			),
		);

		const cite = node.attrs.cite;
		if (typeof cite === "string" && cite.length > 0) {
			decorations.push(
				Decoration.widget(
					position + node.nodeSize - 1,
					(view) => {
						const source = view.dom.ownerDocument.createElement("cite");
						source.className = "article-blockquote-cite";
						source.contentEditable = "false";
						source.textContent = cite;
						return source;
					},
					{ key: `quote-source:${position}:${cite}`, side: 1, ignoreSelection: true },
				),
			);
		}
	});
	return DecorationSet.create(doc, decorations);
}

/** 保留作者写入的出处标记，不将其降为普通正文。 */
export const NativeCite = Mark.create({
	name: "cite",
	// 出处包住强调和链接，避免同一出处被拆成多个 cite。
	priority: 1100,
	parseHTML() {
		return [{ tag: "cite" }];
	},
	renderHTML() {
		return ["cite", 0];
	},
});

/** 装饰引号与属性派生的出处行只进入视图，不进入正文序列化。 */
export const QuotePresentation = Extension.create({
	name: "quotePresentation",
	addGlobalAttributes() {
		return [
			{
				types: ["blockquote"],
				attributes: {
					cite: {
						default: null,
						parseHTML: (element) => element.getAttribute("cite"),
					},
				},
			},
		];
	},
	addProseMirrorPlugins() {
		return [
			new Plugin<DecorationSet>({
				key: quotePresentationKey,
				state: {
					init: (_config, state) => quoteDecorations(state.doc),
					apply(transaction, decorations) {
						if (!transaction.docChanged) {
							return decorations;
						}
						return quoteDecorations(transaction.doc);
					},
				},
				props: {
					decorations: (state) => quotePresentationKey.getState(state),
				},
			}),
		];
	},
});
