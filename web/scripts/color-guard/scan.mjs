import { readdirSync, readFileSync } from "node:fs";
import { matchesGlob, resolve } from "node:path";
import { parse } from "@babel/parser";
import postcss from "postcss";

const utilities =
	"(?:bg|text|border(?:-[xytrblse])?|divide|outline|ring(?:-offset)?|inset-ring|shadow|inset-shadow|text-shadow|drop-shadow|accent|caret|fill|stroke|from|via|to)";
const palette =
	"(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)|black|white)";
const nativeClass = new RegExp(`(?<![\\w-])${utilities}-${palette}(?![\\w-])`, "g");
const legacyClass = new RegExp(
	`(?<![\\w-])${utilities}-(?:primary-base|neon|paper|persona)(?:-[a-z0-9]+)*(?![\\w-])`,
	"g",
);
const legacyName = "(?:primary-base|neon|paper|persona)(?:-[a-z0-9]+)*";
const legacyClassName = new RegExp(`(?<![\\w-])${legacyName}(?![\\w-])`, "g");
const legacySelector = new RegExp(`(?<=\\.)${legacyName}(?![\\w-])`, "g");
const primaryOpacityClass = new RegExp(`^!?${utilities}-primary/[^\\s]*$`);
const primaryVariable = /\bvar\(\s*--(?:color-)?primary\s*[,)]/i;
const hoverVariant = /^(?:(?:group|peer)-)?hover(?:\/[\w-]+)?$/;
const primaryHoverMessage = "悬停请使用 primary-hover token，不要修改 primary 的透明度。";
const roleName = "(?:primary|destructive|warning|success|category-[1-6])";
const roleSuffixClass = new RegExp(`^!?${utilities}-${roleName}-text(?:/.*)?!?$`);
const roleSuffixMessage =
	"文字直接写 text-destructive 等不带后缀的类；-text 变量只在原生 CSS 中使用。";
const solidRoleArbitraryClass = new RegExp(
	`^!?(?:text|caret)-(?:\\[(?:color:)?var\\(--(?:color-)?${roleName}\\)\\]|\\(--(?:color-)?${roleName}\\))(?:/.*)?!?$`,
);
const solidRoleVariable = new RegExp(`var\\(\\s*--(?:color-)?${roleName}\\s*[,)]`, "gi");
const solidRoleMessage = "文字请读对应的 -text 变量（如 --primary-text），实色档不保证可读。";
const textProperties = new Set(["color", "caret-color", "-webkit-text-fill-color"]);
const textStyleKeys = new Set(["color", "caretColor", "WebkitTextFillColor"]);
const references = new Set([
	"href",
	"to",
	"src",
	"id",
	"htmlFor",
	"aria-controls",
	"aria-labelledby",
	"aria-describedby",
]);

function closingParenthesis(value, start) {
	let depth = 1;
	let quote = "";
	for (let index = start + 1; index < value.length; index++) {
		const char = value[index];
		if (char === "\\") {
			index++;
		} else if (quote) {
			if (char === quote) quote = "";
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (char === "(") {
			depth++;
		} else if (char === ")" && --depth === 0) {
			return index;
		}
	}
	return -1;
}

function classSegments(value) {
	const segments = [];
	let depth = 0;
	let start = 0;
	for (let index = 0; index < value.length; index++) {
		const char = value[index];
		if (char === "\\") index++;
		else if (char === "[" || char === "(") depth++;
		else if (char === "]" || char === ")") depth--;
		else if (char === ":" && depth === 0) {
			segments.push(value.slice(start, index));
			start = index + 1;
		}
	}
	segments.push(value.slice(start));
	return segments;
}

function isHoverContext(node) {
	for (let parent = node.parent; parent; parent = parent.parent) {
		if (
			parent.type === "atrule" &&
			parent.name === "variant" &&
			hoverVariant.test(parent.params.trim())
		)
			return true;
		if (parent.type !== "rule") continue;
		let selector = parent.selector;
		for (const match of [...selector.matchAll(/:not\(/g)].reverse()) {
			const end = closingParenthesis(selector, match.index + match[0].length - 1);
			if (end >= 0) selector = selector.slice(0, match.index) + selector.slice(end + 1);
		}
		if (/(?<!\\):hover(?![\w-])/.test(selector)) return true;
	}
	return false;
}

/** 按配置排除算法、生成物、vendor 与实验室；目录使用尾随斜线。 */
export function isExempt(path, config) {
	return config.exemptions.some(({ pattern }) => matchesGlob(path, pattern));
}

/** 扫描静态 TSX 字符串与 CSS 语法节点，返回源码位置，不把注释和 CSS ID 当作色值。 */
export function scanSource(file, source) {
	const findings = [];
	function scanText(
		value,
		offset,
		colors = true,
		classNames = "",
		hovered = false,
		textProperty = false,
	) {
		if (/^(?:https?:\/\/|data:)/i.test(value)) return;
		let text = value.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
		for (const match of [...text.matchAll(/\burl\(/gi)].reverse()) {
			const end = closingParenthesis(text, match.index + match[0].length - 1);
			if (end >= 0)
				text =
					text.slice(0, match.index) +
					text.slice(match.index, end + 1).replace(/[^\n]/g, " ") +
					text.slice(end + 1);
		}
		function report(rule, value, index, message) {
			const position = offset + index;
			const prefix = source.slice(0, position);
			findings.push({
				file,
				line: prefix.split("\n").length,
				column: position - prefix.lastIndexOf("\n"),
				rule,
				value: value.replace(/\s+/g, " ").toLowerCase(),
				...(message ? { message } : {}),
			});
		}
		for (const match of text.matchAll(nativeClass))
			report("tailwind-palette", match[0], match.index);
		for (const match of text.matchAll(legacyClass))
			report("legacy-color", match[0], match.index);
		if (classNames) {
			for (const match of text.matchAll(
				classNames === "selector" ? legacySelector : legacyClassName,
			)) {
				report("legacy-color", match[0], match.index);
			}
		}
		for (const match of text.matchAll(/\S+/g)) {
			const segments = classSegments(match[0]);
			const utility = segments.pop();
			if (
				primaryOpacityClass.test(utility) &&
				(hovered || segments.some((variant) => hoverVariant.test(variant)))
			) {
				report("primary-hover-opacity", match[0], match.index, primaryHoverMessage);
			}
			if (roleSuffixClass.test(utility))
				report("role-text-suffix", match[0], match.index, roleSuffixMessage);
			if (solidRoleArbitraryClass.test(utility))
				report("solid-role-text", match[0], match.index, solidRoleMessage);
		}
		if (textProperty) {
			for (const match of text.matchAll(solidRoleVariable))
				report(
					"solid-role-text",
					match[0].replace(/\s+/g, "").replace(/,$/, ")"),
					match.index,
					solidRoleMessage,
				);
		}
		if (!colors) return;
		if (hovered) {
			for (const match of text.matchAll(
				/(?<![\w-])(?:color-mix|rgba?|hsla?|oklch|oklab|color)\(/gi,
			)) {
				const start = match.index + match[0].length;
				const end = closingParenthesis(text, start - 1);
				if (end < 0) continue;
				const channels = text.slice(start, end);
				if (
					primaryVariable.test(channels) &&
					(match[0].toLowerCase() === "color-mix(" ||
						channels.includes("/") ||
						/^\s*var\(\s*--(?:color-)?primary\s*\)\s*,/i.test(channels))
				) {
					report(
						"primary-hover-opacity",
						text.slice(match.index, end + 1),
						match.index,
						primaryHoverMessage,
					);
				}
			}
		}
		for (const match of text.matchAll(/(?<![\w-])#[\da-f]{3,8}(?![\w-])/gi)) {
			if ([4, 5, 7, 9].includes(match[0].length)) report("raw-color", match[0], match.index);
		}
		for (const match of text.matchAll(/(?<![\w-])(?:oklch|rgba?|hsla?)\(/gi)) {
			const start = match.index + match[0].length;
			const end = closingParenthesis(text, start - 1);
			if (end < 0) continue;
			const channels = text.slice(start, end);
			if (channels.trim() && !/^\s*(?:var\s*\(|from\s+var\s*\()/i.test(channels)) {
				report("raw-color", text.slice(match.index, end + 1), match.index);
			}
		}
	}

	if (file.endsWith(".css")) {
		const css = postcss.parse(source, { from: file });
		css.walkDecls((declaration) => {
			const value = declaration.raws.value?.raw ?? declaration.value;
			const offset =
				declaration.source.start.offset +
				declaration.prop.length +
				declaration.raws.between.length;
			scanText(
				value,
				offset,
				declaration.prop !== "content",
				"",
				isHoverContext(declaration),
				textProperties.has(declaration.prop.toLowerCase()),
			);
		});
		css.walkRules((rule) =>
			scanText(rule.selector, rule.source.start.offset, false, "selector"),
		);
		css.walkAtRules((rule) => {
			const offset =
				rule.source.start.offset +
				rule.name.length +
				1 +
				(rule.raws.afterName?.length ?? 0);
			scanText(
				rule.params,
				offset,
				true,
				["apply", "utility"].includes(rule.name) ? "classes" : "",
				isHoverContext(rule),
			);
		});
	} else {
		const parsed = parse(source, { sourceType: "unambiguous", plugins: ["jsx", "typescript"] });
		function visit(node, parent, classNames = false) {
			if (node.type === "JSXAttribute" && references.has(node.name.name)) return;
			if (node === parent?.source && /^(?:Import|Export)/.test(parent.type)) return;
			classNames ||=
				(node.type === "JSXAttribute" && ["class", "className"].includes(node.name.name)) ||
				(node.type === "CallExpression" &&
					["cn", "clsx", "cva", "tv"].includes(node.callee.name)) ||
				(node.type === "ObjectProperty" &&
					["class", "className"].includes(node.key.name ?? node.key.value));
			if (node.type === "StringLiteral" || node.type === "TemplateElement") {
				const value =
					node.type === "TemplateElement"
						? (node.value.cooked ?? node.value.raw)
						: node.value;
				const raw = source.slice(node.start, node.end);
				const styleKey =
					parent?.type === "ObjectProperty" && parent.value === node
						? (parent.key.name ?? parent.key.value)
						: "";
				scanText(
					value,
					node.start + Math.max(0, raw.indexOf(value)),
					true,
					classNames ? "classes" : "",
					false,
					textStyleKeys.has(styleKey),
				);
			}
			for (const child of Object.values(node)) {
				if (Array.isArray(child)) {
					for (const item of child) if (item?.type) visit(item, node, classNames);
				} else if (child?.type) {
					visit(child, node, classNames);
				}
			}
		}
		visit(parsed);
	}
	return findings.sort(
		(left, right) =>
			left.line - right.line ||
			left.column - right.column ||
			left.rule.localeCompare(right.rule),
	);
}

/** 扫描源码目录中的 TSX/CSS，包括尚未加入 Git 的文件；不跟随目录符号链接。 */
export function scanProject(root, config) {
	const findings = [];
	function visit(directory) {
		if (isExempt(`${directory}/`, config)) return;
		let entries;
		try {
			entries = readdirSync(resolve(root, directory), { withFileTypes: true });
		} catch (error) {
			if (error.code === "ENOENT") return;
			throw error;
		}
		for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
			const file = `${directory}/${entry.name}`;
			if (entry.isDirectory()) visit(file);
			else if (entry.isFile() && /\.(tsx|css)$/.test(file) && !isExempt(file, config)) {
				try {
					findings.push(...scanSource(file, readFileSync(resolve(root, file), "utf8")));
				} catch (error) {
					throw new Error(`${file}: ${error.message}`);
				}
			}
		}
	}
	for (const directory of config.roots) visit(directory);
	return findings;
}
