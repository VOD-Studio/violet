import { mergeAttributes, Node } from "@tiptap/core";

/** GitHub 提示块支持的类型；标题由展示层派生，不写入正文。 */
export const ALERT_TYPES = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const;
type AlertType = (typeof ALERT_TYPES)[number];

function isAlertType(value: unknown): value is AlertType {
	return ALERT_TYPES.some((type) => type === value);
}

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		alert: {
			/** 包装当前块，或修改当前提示块的类型。 */
			setAlert: (type: AlertType) => ReturnType;
			/** 解除提示块包装，保留正文。 */
			unsetAlert: () => ReturnType;
		};
	}
}

/** 可编辑的 GitHub 提示块，复用 Markdown blockquote tokenizer 的代码/转义边界。 */
export const Alert = Node.create({
	name: "alert",
	priority: 110,
	group: "block",
	content: "block+",
	defining: true,
	addAttributes() {
		return {
			alertType: {
				default: "NOTE",
				parseHTML: (element) => element.getAttribute("data-alert-type"),
				renderHTML: ({ alertType }) => ({ "data-alert-type": alertType }),
			},
		};
	},
	parseHTML() {
		return [
			{
				tag: 'blockquote[data-type="alert"]',
				getAttrs: (element) =>
					isAlertType(element.getAttribute("data-alert-type")) ? {} : false,
			},
		];
	},
	renderHTML({ HTMLAttributes }) {
		return ["blockquote", mergeAttributes(HTMLAttributes, { "data-type": "alert" }), 0];
	},
	markdownTokenName: "blockquote",
	parseMarkdown(token, helpers) {
		const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][\t ]*(?:\r?\n|$)/.exec(
			token.text ?? "",
		);
		if (!match) return [];
		const tokens = [...(token.tokens ?? [])];
		const first = tokens[0];
		if (first?.type !== "paragraph") return [];
		const text = (first.text ?? "").replace(
			/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][\t ]*(?:\r?\n|$)/,
			"",
		);
		if (text) {
			tokens[0] = { ...first, text, tokens: helpers.tokenizeInline?.(text) ?? [] };
		} else {
			tokens.shift();
		}
		const content = helpers.parseChildren(tokens);
		return {
			type: "alert",
			attrs: { alertType: match[1] },
			content: content.length ? content : [{ type: "paragraph" }],
		};
	},
	renderMarkdown(node, helpers) {
		const body = helpers
			.renderChildren(node.content ?? [], "\n\n")
			.split("\n")
			.map((line) => (line ? `> ${line}` : ">"))
			.join("\n");
		// Tiptap 序列化普通引用时也会选择首个 blockquote token 处理器。
		return node.type === "alert" ? `> [!${node.attrs?.alertType ?? "NOTE"}]\n${body}` : body;
	},
	addCommands() {
		return {
			setAlert:
				(type) =>
				({ commands, editor }) => {
					if (!isAlertType(type)) return false;
					return editor.isActive(this.name)
						? commands.updateAttributes(this.name, { alertType: type })
						: commands.wrapIn(this.name, { alertType: type });
				},
			unsetAlert:
				() =>
				({ commands }) =>
					commands.lift(this.name),
		};
	},
});
