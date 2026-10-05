import { type JSONContent, type MarkdownToken, Node } from "@tiptap/core";
import { decodeFootnoteLabel } from "./footnote-state";

/** 接受 Goldmark 与 remark 标准 HTML 载体的文末脚注列表。 */
export const Footnotes = Node.create({
	name: "footnotes",
	group: "block",
	content: "footnoteDefinition+",
	defining: true,
	parseHTML() {
		return [
			{
				tag: 'section[data-footnotes], div.footnotes, [role="doc-endnotes"]',
				priority: 100,
				contentElement: "ol",
			},
		];
	},
	renderHTML() {
		return ["section", { "data-footnotes": "", role: "doc-endnotes" }, ["ol", 0]];
	},
	markdownTokenizer: {
		name: "footnotes",
		level: "block",
		start: (source) => source.search(/^ {0,3}\[\^[^\]\n]+\]:/m),
		tokenize(source, _tokens, helpers) {
			const definitions: { label: string; tokens: MarkdownToken[] }[] = [];
			let remaining = source;
			while (remaining) {
				const opening = /^ {0,3}\[\^([^\]\n]+)\]:[ \t]*([^\n]*)(?:\n|$)/.exec(remaining);
				if (!opening) break;
				let raw = opening[0];
				let body = opening[2];
				let rest = remaining.slice(raw.length);
				while (rest) {
					const continuation = /^(?:\n(?= {4}|\t)|(?: {4}|\t)[^\n]*(?:\n|$))/.exec(rest);
					if (!continuation) break;
					raw += continuation[0];
					body += `\n${continuation[0].replace(/^(?: {4}|\t)/, "").replace(/\n$/, "")}`;
					rest = rest.slice(continuation[0].length);
				}
				definitions.push({
					label: decodeFootnoteLabel(opening[1]),
					tokens: helpers.blockTokens(body),
				});
				remaining = remaining.slice(raw.length);
				const gap = /^\n+(?= {0,3}\[\^[^\]\n]+\]:)/.exec(remaining)?.[0] ?? "";
				remaining = remaining.slice(gap.length);
			}
			return definitions.length
				? {
						type: "footnotes",
						raw: source.slice(0, source.length - remaining.length),
						definitions,
					}
				: undefined;
		},
	},
	parseMarkdown(token, helpers) {
		const definitions = token.definitions as { label: string; tokens: MarkdownToken[] }[];
		return {
			type: "footnotes",
			content: definitions.map(
				({ label, tokens }): JSONContent => ({
					type: "footnoteDefinition",
					attrs: { label },
					content: tokens.length
						? helpers.parseChildren(tokens)
						: [{ type: "paragraph" }],
				}),
			),
		};
	},
	renderMarkdown: (node, helpers) => helpers.renderChildren(node.content ?? [], "\n\n"),
});
