import { createPath, ellipse, line, pathFromSvg, polygon, polyline, rect } from "../core/path.ts";
import {
	CLOSE,
	type InkBatch,
	MOVE,
	type Path,
	type Pen,
	type SceneItem,
	type Style,
} from "../core/types.ts";
import { draw } from "../draw.ts";
import { fineliner } from "../pen/fineliner.ts";
import { styles } from "../presets.ts";
import { pathData } from "../render/svg.ts";

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const GEOMETRY_ATTRIBUTES: Record<string, true> = {
	d: true,
	x: true,
	y: true,
	width: true,
	height: true,
	rx: true,
	ry: true,
	cx: true,
	cy: true,
	r: true,
	x1: true,
	x2: true,
	y1: true,
	y2: true,
	points: true,
	pathLength: true,
};
const STROKE_PROPERTIES = [
	"stroke-linecap",
	"stroke-linejoin",
	"stroke-miterlimit",
	"stroke-dasharray",
	"stroke-dashoffset",
	"vector-effect",
	"paint-order",
] as const;
const GROUP_PROPERTIES = [
	"opacity",
	"display",
	"filter",
	"clip-path",
	"mask",
	"mix-blend-mode",
	"transform",
	"transform-origin",
	"transform-box",
	"pointer-events",
] as const;
const MARKER_PROPERTIES = ["marker-start", "marker-mid", "marker-end"] as const;
// 名义线宽不低于 THICK_WIDTH 的线视为粗线（分支、导图连线等），可换用 thickPen
const THICK_WIDTH = 4;
// 只有填充的图形补的描边更细，不抢有描边图形的主次
const OUTLINE_WIDTH = 1.25;
// 已转换图形所在分组的标记，重复调用时跳过
const MARK = "data-inkline";

/** {@link inkSvg} 的参数。 */
export interface InkSvgOptions {
	/** 描绘图形用的风格。 @default styles.natural */
	style?: Style;
	/** 随机种子；同一 SVG、同一 seed 得到相同笔触。 @default 1 */
	seed?: number;
	/** 名义线宽下限，SVG 中更细的描边按它绘制。 @default 1.6 */
	minWidth?: number;
	/** 名义线宽 4 及以上的粗线使用的笔；缺省沿用 style.pen。收尖明显的笔画短粗线会显得像梭形，可换成低压感的笔。 */
	thickPen?: Pen;
}

type Shape = SVGGraphicsElement;
/** 替换前冻结的计算样式。 */
type Snapshot = Pick<CSSStyleDeclaration, "getPropertyValue">;
type LengthProperty = { baseVal: { value: number } };

const SNAPSHOT_PROPERTIES = [
	...STROKE_PROPERTIES,
	...GROUP_PROPERTIES,
	...MARKER_PROPERTIES,
	"fill",
	"stroke",
	"fill-opacity",
	"stroke-opacity",
	"stroke-width",
	"fill-rule",
	"d",
	"x",
	"y",
	"width",
	"height",
	"rx",
	"ry",
	"cx",
	"cy",
	"r",
	"x1",
	"x2",
	"y1",
	"y2",
] as const;

function localUrl(value: string): string {
	return value.replace(/url\(["']?[^)"']*#([^\s)"']+)["']?\)/g, 'url("#$1")');
}

function pin(element: SVGElement, property: string, value: string): void {
	if (value) element.style.setProperty(property, localUrl(value), "important");
}

// 新建笔迹统一写入的中性声明，屏蔽 Mermaid 样式表对 path 选择器施加的效果。
const NEUTRAL = [
	"opacity:1",
	"filter:none",
	"transform:none",
	"clip-path:none",
	"mask:none",
	"shape-rendering:geometricPrecision",
	...MARKER_PROPERTIES.map((property) => `${property}:none`),
]
	.map((declaration) => `${declaration} !important`)
	.join(";");

function isPainted(paint: string, opacity: string): boolean {
	const transparent =
		paint === "none" ||
		paint === "transparent" ||
		(paint.startsWith("rgba(") && /,\s*0(?:\.0+)?\s*\)$/.test(paint)) ||
		/\/\s*0(?:\.0+)?\s*\)$/.test(paint);
	return !transparent && Number(opacity || 1) > 0;
}

function length(shape: Shape, style: Snapshot, name: string): number {
	const css = style.getPropertyValue(name);
	if (/^-?(?:\d+\.?\d*|\.\d+)(?:px)?$/.test(css)) return Number.parseFloat(css);
	const animated = (shape as unknown as Record<string, LengthProperty>)[name];
	return animated?.baseVal?.value ?? Number(shape.getAttribute(name) ?? 0);
}

function points(shape: Shape): [number, number][] {
	const values =
		(shape.getAttribute("points") ?? "").match(
			/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g,
		) ?? [];
	const result: [number, number][] = [];
	for (let index = 0; index + 1 < values.length; index += 2) {
		result.push([Number(values[index]), Number(values[index + 1])]);
	}
	return result;
}

function isBackingRect(shape: Shape, svg: SVGSVGElement): boolean {
	if (shape.localName !== "rect") return false;
	const box = shape.getBBox();
	if (shape.parentNode === svg) {
		const viewport = svg.viewBox.baseVal;
		if (
			Math.abs(box.x - viewport.x) < 1 &&
			Math.abs(box.y - viewport.y) < 1 &&
			Math.abs(box.width - viewport.width) < 1 &&
			Math.abs(box.height - viewport.height) < 1
		)
			return true;
	}
	for (const sibling of Array.from(shape.parentElement?.children ?? [])) {
		if (sibling.localName !== "text" && sibling.localName !== "foreignObject") continue;
		const textBox = (sibling as SVGGraphicsElement).getBBox();
		// 紧贴文字的背景负责遮挡连线，不作为节点新增描边。
		if (
			textBox.width > 0 &&
			textBox.height > 0 &&
			textBox.x >= box.x - 1 &&
			textBox.y >= box.y - 1 &&
			textBox.x + textBox.width <= box.x + box.width + 1 &&
			textBox.y + textBox.height <= box.y + box.height + 1 &&
			box.width - textBox.width <= 8 &&
			box.height - textBox.height <= 8
		)
			return true;
	}
	return false;
}

function geometry(shape: Shape, style: Snapshot): Path {
	const value = (name: string) => length(shape, style, name);
	switch (shape.localName) {
		case "rect": {
			const x = value("x");
			const y = value("y");
			const width = value("width");
			const height = value("height");
			const hasRx =
				shape.hasAttribute("rx") ||
				(style.getPropertyValue("rx") !== "auto" && !!style.getPropertyValue("rx"));
			const hasRy =
				shape.hasAttribute("ry") ||
				(style.getPropertyValue("ry") !== "auto" && !!style.getPropertyValue("ry"));
			const rx = Math.min(width / 2, hasRx ? value("rx") : value("ry"));
			const ry = Math.min(height / 2, hasRy ? value("ry") : value("rx"));
			if (!rx || !ry) return rect(x, y, width, height);
			return pathFromSvg(
				`M${x + rx},${y}H${x + width - rx}A${rx},${ry} 0 0 1 ${x + width},${y + ry}V${y + height - ry}A${rx},${ry} 0 0 1 ${x + width - rx},${y + height}H${x + rx}A${rx},${ry} 0 0 1 ${x},${y + height - ry}V${y + ry}A${rx},${ry} 0 0 1 ${x + rx},${y}Z`,
			);
		}
		case "line":
			return line(value("x1"), value("y1"), value("x2"), value("y2"));
		case "circle":
			return ellipse(value("cx"), value("cy"), value("r"), value("r"));
		case "ellipse":
			return ellipse(value("cx"), value("cy"), value("rx"), value("ry"));
		case "polygon":
			return polygon(points(shape));
		case "polyline":
			return polyline(points(shape));
		default: {
			const cssPath = style.getPropertyValue("d").match(/^path\(["'](.*)["']\)$/);
			return pathFromSvg(cssPath?.[1] ?? shape.getAttribute("d") ?? "");
		}
	}
}

/** 给每个子路径补上闭合：SVG 会隐式闭合开放子路径来填色，绘图库只填闭合轮廓。 */
function closeSubpaths(path: Path, fillRule: Path["fillRule"]): Path {
	const verbs: number[] = [];
	for (const verb of path.verbs) {
		if (verb === MOVE && verbs.length && verbs[verbs.length - 1] !== CLOSE) verbs.push(CLOSE);
		verbs.push(verb);
	}
	if (verbs.length && verbs[verbs.length - 1] !== CLOSE) verbs.push(CLOSE);
	return createPath(Uint8Array.from(verbs), path.coords, fillRule);
}

interface Paint {
	fill: string;
	fillOpacity: number;
	outline: string;
	outlineOpacity: number;
	/** 描边批次额外沿用的线帽、虚线等声明，已带 !important 与分号。 */
	strokeDetail: string;
}

function inkPath(doc: Document, batch: InkBatch, paint: Paint): SVGPathElement {
	const path = doc.createElementNS(SVG_NS, "path");
	path.setAttribute("d", pathData(batch.verbs, batch.coords));
	const area = batch.role === "fill";
	// 草稿复线的不透明度并入颜色透明度，元素 opacity 只由所在分组承担。
	const alpha = (area ? paint.fillOpacity : paint.outlineOpacity) * (batch.opacity ?? 1);
	const color = area ? paint.fill : paint.outline;
	// 整串写入 style 属性，比逐项 setProperty 少十余次样式解析
	const look =
		batch.mode === "stroke"
			? `fill:none !important;stroke:${color} !important;stroke-width:${batch.width ?? 1} !important;stroke-opacity:${alpha} !important;${paint.strokeDetail}`
			: `fill:${color} !important;stroke:none !important;stroke-width:0 !important;fill-opacity:${alpha} !important;fill-rule:${batch.fillRule ?? "nonzero"} !important;`;
	path.setAttribute("style", look + NEUTRAL);
	return path;
}

function preserveCarrier(
	shape: Shape,
	group: SVGGElement,
	style: Snapshot,
	textPaths: SVGTextPathElement[],
	index: number,
): void {
	const hasMarker = MARKER_PROPERTIES.some((property) => {
		const marker = style.getPropertyValue(property);
		return marker && marker !== "none";
	});
	if (!hasMarker && !textPaths.length) return;
	// 用唯一精确中心线承载箭头，避免两条随机笔触各生成一个箭头。
	const carrier = shape.cloneNode(false) as Shape;
	for (const attribute of Array.from(carrier.attributes)) {
		if (!GEOMETRY_ATTRIBUTES[attribute.name]) carrier.removeAttribute(attribute.name);
	}
	for (const property of SNAPSHOT_PROPERTIES) {
		if (GEOMETRY_ATTRIBUTES[property]) pin(carrier, property, style.getPropertyValue(property));
	}
	pin(carrier, "fill", "none");
	pin(carrier, "stroke", "none");
	pin(carrier, "stroke-width", style.getPropertyValue("stroke-width") || "1");
	pin(carrier, "opacity", "1");
	pin(carrier, "transform", "none");
	pin(carrier, "filter", "none");
	pin(carrier, "clip-path", "none");
	pin(carrier, "mask", "none");
	for (const property of MARKER_PROPERTIES) {
		pin(carrier, property, style.getPropertyValue(property) || "none");
	}
	carrier.setAttribute("aria-hidden", "true");
	if (textPaths.length) {
		let id = `${shape.id}-inkline-centerline-${index}`;
		while (shape.ownerDocument.getElementById(id)) id += "-";
		carrier.id = id;
		for (const textPath of textPaths) {
			if (textPath.hasAttribute("href")) textPath.setAttribute("href", `#${id}`);
			if (textPath.hasAttributeNS(XLINK_NS, "href"))
				textPath.setAttributeNS(XLINK_NS, "xlink:href", `#${id}`);
		}
	}
	group.appendChild(carrier);
}

/**
 * classic 外观下 Mermaid 用内置 Rough.js（粗糙度 0）画的节点：未闭合的填充轮廓（stroke="none"）
 * 配一条把每条边拆开并画两遍的描边（fill="none"）。返回该描边，由填充轮廓闭合后统一描绘。
 */
function roughOutlineOf(shape: Shape): Shape | undefined {
	const parent = shape.parentElement;
	if (shape.localName !== "path" || shape.getAttribute("stroke") !== "none") return undefined;
	if (!parent?.classList.contains("outer-path")) return undefined;
	return Array.from(parent.children).find(
		(sibling): sibling is Shape =>
			sibling !== shape &&
			sibling.localName === "path" &&
			sibling.getAttribute("fill") === "none",
	);
}

interface Sketched {
	shape: Shape;
	style: Snapshot;
	index: number;
	paint: Paint;
	items: SceneItem[];
}

/**
 * 把已渲染、已挂在页面上的 SVG 原地重画成手绘风格：图形换成 inkline 笔触，布局、文字、箭头标记与颜色保留。
 *
 * @param svg - 已挂在文档中的 SVG，需要读取实际样式与尺寸；例如 Mermaid、Graphviz 或 D3 的输出
 * @throws 当 SVG 不在浏览器文档中时
 * @remarks 文字、图片与 marker 不改动；虚线改用签字笔以保留 stroke-dasharray；紧贴文字的背景矩形不加框；
 * 只有填充的图形以填充色补描边；Mermaid classic 外观中由其内置 Rough.js 画的节点合成一个闭合图形。
 * 已转换的图形带有 data-inkline 标记，重复调用不会画出两层。
 *
 * @example
 * ```ts
 * const { svg } = await mermaid.render("flow", "graph LR; A --> B");
 * host.innerHTML = svg;
 * inkSvg(host.querySelector("svg")!, { style: { ...styles.draft, pen: gpen } });
 * ```
 */
export function inkSvg(svg: SVGSVGElement, options: InkSvgOptions = {}): void {
	const baseStyle = options.style ?? styles.natural;
	const minWidth = options.minWidth ?? 1.6;
	// G 笔等变宽笔的条带轮廓是填充，套不上 stroke-dasharray，虚线改由签字笔原生描边承载
	const dashedStyle: Style = { ...baseStyle, pen: fineliner, fillPen: fineliner };
	const thickStyle: Style | undefined = options.thickPen && {
		...baseStyle,
		pen: options.thickPen,
	};
	const view = svg.ownerDocument.defaultView;
	if (!view) throw new Error("inkSvg needs an SVG element attached to a browser document.");
	const textPaths = Array.from(svg.querySelectorAll<SVGTextPathElement>("textPath"));
	// 替换元素前冻结样式，避免标签与相邻选择器随 DOM 结构变化。
	const shapes = Array.from(
		svg.querySelectorAll<Shape>("rect,line,path,circle,ellipse,polygon,polyline"),
	)
		.filter(
			(shape) =>
				!shape.closest(`defs,clipPath,mask,marker,pattern,symbol,foreignObject,[${MARK}]`),
		)
		.map((shape) => {
			const computed = view.getComputedStyle(shape);
			// 存进 Map 而不是写进临时元素的 style：后者每次 setProperty 都要重新解析取值
			const values = new Map<string, string>();
			for (const property of SNAPSHOT_PROPERTIES)
				values.set(property, computed.getPropertyValue(property));
			const style: Snapshot = { getPropertyValue: (name) => values.get(name) ?? "" };
			return { shape, style };
		});
	const styleOf = new Map(shapes.map(({ shape, style }) => [shape, style]));
	const outlines = new Map<Shape, Snapshot>();
	const duplicates = new Set<Shape>();
	for (const { shape } of shapes) {
		const outline = roughOutlineOf(shape);
		const outlineStyle = outline && styleOf.get(outline);
		if (!outline || !outlineStyle) continue;
		outlines.set(shape, outlineStyle);
		duplicates.add(outline);
	}

	const sketched: Sketched[] = [];
	for (const [index, { shape, style }] of shapes.entries()) {
		if (duplicates.has(shape)) continue;
		// 零尺寸矩形在 SVG 中不可见，不能被随机笔触变成散点。
		if (
			shape.localName === "rect" &&
			(length(shape, style, "width") <= 0 || length(shape, style, "height") <= 0)
		)
			continue;
		const strokeStyle = outlines.get(shape) ?? style;
		const fill = style.getPropertyValue("fill") || "black";
		const stroke = strokeStyle.getPropertyValue("stroke") || "none";
		const fillVisible =
			shape.localName !== "line" && isPainted(fill, style.getPropertyValue("fill-opacity"));
		const strokeWidth = Number.parseFloat(strokeStyle.getPropertyValue("stroke-width") || "1");
		const strokeVisible =
			strokeWidth > 0 && isPainted(stroke, strokeStyle.getPropertyValue("stroke-opacity"));
		if (
			(!fillVisible && !strokeVisible) ||
			style.getPropertyValue("display") === "none" ||
			Number(style.getPropertyValue("opacity") || 1) === 0
		)
			continue;
		const syntheticStroke = !strokeVisible && fillVisible && !isBackingRect(shape, svg);
		const fillRule = style.getPropertyValue("fill-rule") === "evenodd" ? "evenodd" : "nonzero";
		const source = geometry(shape, style);
		const closed = closeSubpaths(source, fillRule);
		const id = String(index);
		const items: SceneItem[] = [];
		if (fillVisible)
			items.push({ id: `${id}:fill`, path: closed, fillRole: "fill", strokeRole: "none" });
		if (strokeVisible || syntheticStroke) {
			const dash = strokeStyle.getPropertyValue("stroke-dasharray");
			const dashed = dash.split(/[\s,]+/).some((part) => Number.parseFloat(part) > 0);
			items.push({
				id,
				// 合并后的 Rough.js 节点以闭合的填充轮廓为描边
				path: outlines.has(shape) ? closed : source,
				strokeRole: "ink",
				lineWidth: syntheticStroke ? OUTLINE_WIDTH : Math.max(minWidth, strokeWidth),
				// 连线锚定在节点边缘，端点不能被手法扰动
				pinEnds: true,
				style: dashed
					? dashedStyle
					: strokeWidth >= THICK_WIDTH && !syntheticStroke
						? thickStyle
						: undefined,
			});
		}
		const fillOpacity = Number(style.getPropertyValue("fill-opacity") || 1);
		sketched.push({
			shape,
			style,
			index,
			items,
			paint: {
				fill: localUrl(fill),
				fillOpacity,
				outline: localUrl(syntheticStroke ? fill : stroke),
				strokeDetail: STROKE_PROPERTIES.map((property) => {
					const value = strokeStyle.getPropertyValue(property);
					return value ? `${property}:${localUrl(value)} !important;` : "";
				}).join(""),
				outlineOpacity: syntheticStroke
					? fillOpacity
					: Number(strokeStyle.getPropertyValue("stroke-opacity") || 1),
			},
		});
	}

	// 场景尺寸只是元数据，几何都在各图形自身的坐标系中
	const drawing = draw(
		{ width: 0, height: 0, items: sketched.flatMap((entry) => entry.items) },
		{ style: baseStyle, seed: options.seed },
	);
	const drawn = new Map(drawing.items.map((item) => [item.id, item]));

	for (const duplicate of duplicates) duplicate.remove();
	for (const { shape, style, index, items, paint } of sketched) {
		const group = svg.ownerDocument.createElementNS(SVG_NS, "g");
		for (const item of items)
			for (const batch of drawn.get(item.id)?.batches ?? [])
				group.appendChild(inkPath(svg.ownerDocument, batch, paint));
		for (const attribute of Array.from(shape.attributes)) {
			if (!GEOMETRY_ATTRIBUTES[attribute.name]) {
				group.setAttributeNS(attribute.namespaceURI, attribute.name, attribute.value);
			}
		}
		group.setAttribute(MARK, "");
		for (const property of GROUP_PROPERTIES)
			pin(group, property, style.getPropertyValue(property));
		for (const property of MARKER_PROPERTIES) pin(group, property, "none");
		const references = shape.id
			? textPaths.filter(
					(textPath) =>
						(textPath.getAttribute("href") ??
							textPath.getAttributeNS(XLINK_NS, "href")) === `#${shape.id}`,
				)
			: [];
		preserveCarrier(shape, group, style, references, index);
		while (shape.firstChild) group.appendChild(shape.firstChild);
		shape.replaceWith(group);
	}
}
