import type { Element, Nodes, Root } from "hast";
import type { Transformer } from "unified";
import { parseFenceInfo, readRawFenceInfo } from "@/shared/lib/markdown/fence-info";

function sourceText(node: Nodes): string {
	if (node.type === "text") return node.value;
	return "children" in node ? node.children.map(sourceText).join("") : "";
}

/** 将已解析的围栏转为与存储 HTML 相同的阅读载体。 */
export function rehypeCodeCarriers(): Transformer<Root, Root> {
	return (tree, file) => {
		const markdown = file.toString();
		const visit = (node: Nodes) => {
			if (node.type === "element" && node.tagName === "pre") {
				const code = node.children[0];
				if (code?.type === "element" && code.tagName === "code") {
					const classes = code.properties.className;
					const language =
						(Array.isArray(classes) ? classes.join(" ") : String(classes ?? "")).match(
							/(?:^|\s)language-(\S+)/u,
						)?.[1] ?? "";
					const offset = node.position?.start.offset;
					const rawInfo =
						offset === undefined ? undefined : readRawFenceInfo(markdown, offset);
					const info = parseFenceInfo(
						rawInfo ?? `${language} ${String(code.data?.meta ?? "")}`,
					);
					const source = sourceText(code).replace(/\n$/u, "");
					node.properties.dataLang = info.language;
					node.properties.dataSource = source;
					if (info.overrides) node.properties.dataOverrides = info.overrides;
					if (info.filename !== null) node.properties.dataFilename = info.filename;
					if (info.highlightLines) node.properties.dataLines = info.highlightLines;
					if (info.language === "mermaid" && !info.runnable) {
						node.tagName = "div";
						node.properties = {
							dataType: "diagram-block",
							dataFormat: "mermaid",
							dataSource: source,
						};
						node.children = [];
					} else if (info.runnable) {
						node.properties = {
							...node.properties,
							dataRunnable: "true",
							dataLang: info.language,
							dataSource: source,
							...(info.overrides ? { dataOverrides: info.overrides } : {}),
						};
					} else if (!language) {
						// 显式语言用于区分单行围栏与行内代码。
						(code as Element).properties.className = ["language-text"];
					}
				}
			}
			if ("children" in node) for (const child of node.children) visit(child);
		};
		visit(tree);
	};
}
