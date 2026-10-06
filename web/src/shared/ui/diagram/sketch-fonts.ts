import excalifontLicense from "../../../assets/fonts/diagram/Excalifont-OFL.txt?raw";
import xiaolaiLicense from "../../../assets/fonts/diagram/Xiaolai-OFL.txt?raw";
import diagramFontCss from "../../../styles/diagram-fonts.css?inline";

/** 在 Mermaid 测量标签前使用；官方字体未覆盖的字符回退到 sans-serif。 */
export const DIAGRAM_FONT_FAMILY = '"Excalifont", "Xiaolai SC", sans-serif';

interface FontShard {
	family: string;
	url: string;
	unicodeRange: string;
	ranges: [number, number][];
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const STYLE_ATTRIBUTE = "data-diagram-fonts";
const CDN_STYLESHEET =
	"https://cn-font.claude-code-best.win/packages/xiaolai/dist/Xiaolai/result.css";
const CDN_FONT_DIRECTORY = new URL(".", CDN_STYLESHEET).href;
const EXCALIFONT_CDN_DIRECTORY =
	"https://cdn.jsdelivr.net/npm/@excalidraw/excalidraw@0.18.1/dist/prod/fonts/Excalifont/";
let fontShards: FontShard[] | undefined;
let allFontShards: Promise<FontShard[]> | undefined;
const embeddedFonts = new Map<string, Promise<string>>();

function parseFontShards(css: string, baseUrl: string): FontShard[] {
	return Array.from(css.matchAll(/@font-face\s*\{([^}]+)\}/g), (match) => {
		const rule = match[1];
		const familyMatch = /font-family:\s*(?:"([^"]+)"|'([^']+)'|([^;]+))/.exec(rule);
		const family = (familyMatch?.[1] ?? familyMatch?.[2] ?? familyMatch?.[3])?.trim();
		const url = /\burl\(\s*["']?([^\s"')]+)["']?\s*\)/.exec(rule)?.[1];
		const unicodeRange = /unicode-range:\s*([^;]+)/.exec(rule)?.[1];
		if (!family || !url || !unicodeRange) throw new Error("图表字体元数据无效");
		const ranges = unicodeRange.split(",").map((range): [number, number] => {
			const value = /^U\+([0-9a-f?]+)(?:-([0-9a-f]+))?$/i.exec(range.trim());
			if (!value) throw new Error("图表字体 Unicode 范围无效");
			const [, start, end] = value;
			// CSS 压缩器可将等价 Unicode 范围改为通配符写法。
			return [
				Number.parseInt(start.replaceAll("?", "0"), 16),
				Number.parseInt((end ?? start).replaceAll("?", "f"), 16),
			];
		});
		return { family, url: new URL(url, baseUrl).href, unicodeRange, ranges };
	});
}

function coversCharacter(shard: FontShard, character: string): boolean {
	const point = character.codePointAt(0);
	return (
		point !== undefined && shard.ranges.some(([start, end]) => point >= start && point <= end)
	);
}

async function getFontShards(text: string): Promise<FontShard[]> {
	fontShards ??= parseFontShards(diagramFontCss, document.baseURI);
	if (
		Array.from(text).every((character) =>
			fontShards?.some((shard) => coversCharacter(shard, character)),
		)
	) {
		return fontShards;
	}
	// 官方 CDN 会重定向至其 ImageKit 字体存储；请求不携带凭据。
	allFontShards ??= fetch(CDN_STYLESHEET, { credentials: "omit" })
		.then(async (response) => {
			if (!response.ok) throw new Error(`中文图表字体加载失败：HTTP ${response.status}`);
			const remote = parseFontShards(await response.text(), CDN_STYLESHEET);
			if (
				!remote.length ||
				remote.some(
					(shard) =>
						shard.family !== "Xiaolai SC" || !shard.url.startsWith(CDN_FONT_DIRECTORY),
				)
			)
				throw new Error("中文图表字体 CDN 元数据无效");
			return [...(fontShards ?? []), ...remote];
		})
		.catch((error: unknown) => {
			allFontShards = undefined;
			throw error;
		});
	return allFontShards;
}

function selectFontShards(text: string, shards: FontShard[]): Map<FontShard, string> {
	const selected = new Map<FontShard, string>();
	for (const character of new Set(text)) {
		const shard = shards.find((candidate) => coversCharacter(candidate, character));
		if (shard) selected.set(shard, (selected.get(shard) ?? "") + character);
	}
	return selected;
}

function registerFontCss(css: string, kind: "screen" | "cdn"): void {
	if (document.head.querySelector(`style[${STYLE_ATTRIBUTE}="${kind}"]`)) return;
	const style = document.createElement("style");
	style.setAttribute(STYLE_ATTRIBUTE, kind);
	style.textContent = css;
	document.head.append(style);
}

function fontFaceRule(shard: FontShard, url: string): string {
	return `@font-face{font-family:"${shard.family}";src:url("${url}") format("woff2");font-style:normal;font-weight:400;font-display:block;unicode-range:${shard.unicodeRange};}`;
}

/** 懒注册字体规则，并在图表布局前等待所需字符的字体子集。 */
export async function loadDiagramFonts(text: string): Promise<void> {
	if (typeof document === "undefined") return;
	registerFontCss(diagramFontCss, "screen");
	// jsdom 没有字体引擎，仅保留样式注册以支持 DOM 契约测试。
	if (typeof FontFace === "undefined" || !document.fonts?.load) return;
	const shards = await getFontShards(text);
	if (
		shards.some((shard) => shard.family === "Xiaolai SC") &&
		!document.head.querySelector(`style[${STYLE_ATTRIBUTE}="cdn"]`)
	) {
		// 仅读取官方字体规则，不将远程样式表中的其他 CSS 注入页面。
		registerFontCss(
			shards
				.filter((shard) => shard.family === "Xiaolai SC")
				.map((shard) => fontFaceRule(shard, shard.url))
				.join("\n"),
			"cdn",
		);
	}
	await Promise.all(
		Array.from(selectFontShards(text, shards), ([shard, characters]) =>
			document.fonts.load(`400 16px "${shard.family}"`, characters),
		),
	);
}

async function fetchEmbeddedFont(url: string): Promise<string> {
	const allowed = [CDN_FONT_DIRECTORY, EXCALIFONT_CDN_DIRECTORY].some((directory) =>
		url.startsWith(directory),
	);
	const resolved = new URL(url, document.baseURI);
	if (!allowed || resolved.protocol !== "https:") {
		throw new Error("图表字体来源不在许可范围内");
	}
	const response = await fetch(resolved.href, {
		credentials: "omit",
		redirect: "follow",
	});
	if (!response.ok) {
		throw new Error(`图表字体加载失败：HTTP ${response.status}`);
	}
	const bytes = new Uint8Array(await response.arrayBuffer());
	if (bytes[0] !== 0x77 || bytes[1] !== 0x4f || bytes[2] !== 0x46 || bytes[3] !== 0x32) {
		throw new Error("图表字体响应不是 WOFF2 文件");
	}
	let binary = "";
	for (let offset = 0; offset < bytes.length; offset += 8192) {
		binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
	}
	return `data:font/woff2;base64,${btoa(binary)}`;
}

function getEmbeddedFont(url: string): Promise<string> {
	const cached = embeddedFonts.get(url);
	if (cached) return cached;
	const loading = fetchEmbeddedFont(url).catch((error: unknown) => {
		embeddedFonts.delete(url);
		throw error;
	});
	embeddedFonts.set(url, loading);
	return loading;
}

function getSvgText(svg: Element): string {
	const labels: string[] = [];
	for (const label of svg.querySelectorAll("text, foreignObject")) {
		const walker = svg.ownerDocument.createTreeWalker(label, NodeFilter.SHOW_TEXT);
		let node = walker.nextNode();
		while (node) {
			if (!node.parentElement?.closest("style, script")) {
				labels.push(node.textContent ?? "");
			}
			node = walker.nextNode();
		}
	}
	return labels.join("");
}

async function getEmbeddedFontCss(shards: Iterable<FontShard>): Promise<string> {
	const rules = await Promise.all(
		Array.from(shards, async (shard) => {
			const data = await getEmbeddedFont(shard.url);
			return fontFaceRule(shard, data);
		}),
	);
	return rules.join("\n");
}

/** 将实际标签需要的官方字体子集嵌入已净化的 SVG，供文件独立打开。 */
export async function embedDiagramFonts(svg: string): Promise<string> {
	const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
	const root = parsed.documentElement;
	if (
		root.localName !== "svg" ||
		root.namespaceURI !== SVG_NAMESPACE ||
		parsed.querySelector("parsererror")
	) {
		throw new Error("无法解析待导出的图表 SVG");
	}
	const text = getSvgText(root);
	if (!text) return svg;
	const selected = selectFontShards(text, await getFontShards(text));
	if (selected.size === 0) return svg;
	const rules = await getEmbeddedFontCss(selected.keys());
	for (const style of root.querySelectorAll(
		`style[${STYLE_ATTRIBUTE}], metadata[${STYLE_ATTRIBUTE}]`,
	)) {
		style.remove();
	}
	const style = parsed.createElementNS(SVG_NAMESPACE, "style");
	style.setAttribute(STYLE_ATTRIBUTE, "embedded");
	style.textContent = rules;
	const metadata = parsed.createElementNS(SVG_NAMESPACE, "metadata");
	metadata.setAttribute(STYLE_ATTRIBUTE, "licenses");
	metadata.textContent = Array.from(
		new Set(Array.from(selected.keys(), (shard) => shard.family)),
		(family) => `${family}\n${family === "Excalifont" ? excalifontLicense : xiaolaiLicense}`,
	).join("\n\n");
	root.prepend(style, metadata);
	return new XMLSerializer().serializeToString(root);
}
