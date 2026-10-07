import type { Element, Nodes } from "hast";
import { defaultSchema, type Schema, sanitize } from "hast-util-sanitize";

const schema: Schema = {
	...defaultSchema,
	attributes: {
		...defaultSchema.attributes,
		"*": [...(defaultSchema.attributes?.["*"] ?? []), "className", "id"],
		a: [
			...(defaultSchema.attributes?.a ?? []),
			"dataFootnoteRef",
			"dataFootnoteBackref",
			"dataFootnoteLabel",
			"ariaLabel",
			"ariaDescribedBy",
			["role", "doc-noteref", "doc-backlink"],
		],
		section: ["dataFootnotes", ["role", "doc-endnotes"]],
		blockquote: [
			...(defaultSchema.attributes?.blockquote ?? []),
			["dataType", "alert"],
			["dataAlertType", "NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"],
		],
		details: [...(defaultSchema.attributes?.details ?? []), "open"],
		code: [
			...(defaultSchema.attributes?.code ?? []).filter(
				(attribute) =>
					(Array.isArray(attribute) ? attribute[0] : attribute) !== "className",
			),
			["className", /^language-./u, "math-inline", "math-display"],
		],
		mark: ["dataColor", "style"],
		input: [["type", "checkbox"], "checked", "disabled"],
		ul: [...(defaultSchema.attributes?.ul ?? []), "dataType"],
		li: [
			...(defaultSchema.attributes?.li ?? []),
			"dataType",
			"dataChecked",
			"dataFootnoteLabel",
		],
		span: [...(defaultSchema.attributes?.span ?? []), "dataType", "dataLatex", "style"],
		div: [
			...(defaultSchema.attributes?.div ?? []),
			"dataType",
			"dataLatex",
			"dataFormat",
			"dataSource",
			["role", "doc-endnotes"],
		],
		pre: [
			...(defaultSchema.attributes?.pre ?? []),
			"dataRunnable",
			"dataLang",
			"dataOverrides",
			"dataSource",
		],
		p: [...(defaultSchema.attributes?.p ?? []), "style"],
		h1: [...(defaultSchema.attributes?.h1 ?? []), "style"],
		h2: [...(defaultSchema.attributes?.h2 ?? []), "style"],
		h3: [...(defaultSchema.attributes?.h3 ?? []), "style"],
		h4: [...(defaultSchema.attributes?.h4 ?? []), "style"],
		h5: [...(defaultSchema.attributes?.h5 ?? []), "style"],
		h6: [...(defaultSchema.attributes?.h6 ?? []), "style"],
		th: [...(defaultSchema.attributes?.th ?? []), "style", "colSpan", "rowSpan"],
		td: [...(defaultSchema.attributes?.td ?? []), "style", "colSpan", "rowSpan"],
	},
	tagNames: [
		...(defaultSchema.tagNames ?? []),
		"figure",
		"figcaption",
		"details",
		"summary",
		"mark",
		"kbd",
		"abbr",
		"span",
		"u",
		"input",
		"label",
		"section",
	],
	// 标题与脚注双向链接必须沿用存储时的同一组 id。
	clobberPrefix: "",
};

const alignmentTags: Record<string, true> = {
	p: true,
	h1: true,
	h2: true,
	h3: true,
	h4: true,
	h5: true,
	h6: true,
	th: true,
	td: true,
};
const color = /^(?:#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|[a-z]+|(?:rgb|hsl)a?\([\d\s.,%+/-]+\))$/iu;

function cleanStyle(element: Element) {
	const value = element.properties.style;
	if (typeof value !== "string") return;
	const declarations: string[] = [];
	for (const declaration of value.split(";")) {
		const colon = declaration.indexOf(":");
		if (colon < 0) continue;
		const property = declaration.slice(0, colon).trim().toLowerCase();
		const value = declaration.slice(colon + 1).trim();
		if (
			property === "text-align" &&
			alignmentTags[element.tagName] &&
			/^(left|right|center|justify|start|end)$/u.test(value)
		) {
			declarations.push(`${property}:${value}`);
		} else if (
			((element.tagName === "span" && property === "color") ||
				(element.tagName === "mark" &&
					(property === "color" || property === "background-color"))) &&
			color.test(value)
		) {
			declarations.push(`${property}:${value}`);
		}
	}
	if (declarations.length) element.properties.style = declarations.join(";");
	else delete element.properties.style;
}

function hasCheckbox(node: Nodes): boolean {
	if (node.type === "element" && node.tagName === "li") return false;
	if (node.type === "element" && node.tagName === "input" && node.properties.type === "checkbox")
		return true;
	return "children" in node && node.children.some(hasCheckbox);
}

/** 清洗 HTML，并为仅含状态的任务载体补回复选框，已有 input 不重复生成。 */
export function sanitizeContent(tree: Nodes): Nodes {
	const cleaned = sanitize(tree, schema);
	const visit = (node: Nodes) => {
		if (node.type === "element") {
			cleanStyle(node);
			if (
				node.tagName === "li" &&
				node.properties.dataType === "taskItem" &&
				!node.children.some(hasCheckbox)
			) {
				node.children.unshift({
					type: "element",
					tagName: "input",
					properties: {
						type: "checkbox",
						checked:
							node.properties.dataChecked === "true" ||
							node.properties.dataChecked === true,
						disabled: true,
					},
					children: [],
				});
			}
			if (node.tagName === "input") node.properties.disabled = true;
		}
		if ("children" in node) for (const child of node.children) visit(child);
	};
	visit(cleaned);
	return cleaned;
}
