import {
	CLOSE,
	createGPen,
	createPath,
	draw,
	ellipse,
	fineliner,
	gpen,
	type InkBatch,
	line,
	MOVE,
	type Path,
	pathFromSvg,
	polygon,
	polyline,
	rect,
	type SceneItem,
	type Style,
	styles,
} from "@violet/inkline";
import { pathData } from "@violet/inkline/svg";

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
// G 笔配草稿手法；虚线改由签字笔原生描边承载，G 笔的条带轮廓是填充，套不上 stroke-dasharray。
const SKETCH: Style = { ...styles.draft, pen: gpen, fillPen: gpen };
const DASHED: Style = { ...styles.draft, pen: fineliner, fillPen: fineliner };
// 分支、导图连线等粗线：G 笔压感收到两端只剩 75% 宽，短粗线不至于收成一串梭形。
const THICK: Style = { ...styles.draft, pen: createGPen({ pressure: 0.25 }) };
const THICK_WIDTH = 4;
// 名义线宽下限，与对照页确认的 G 笔观感一致；只有填充的节点补的描边更细，不抢有描边节点的主次。
const MIN_WIDTH = 1.6;
const SYNTHETIC_WIDTH = 1.25;

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
		let id = `${shape.id}-sketch-centerline-${index}`;
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
 * 原地转换已净化的可见 SVG 几何；保留 Mermaid 布局、箭头与文字引用。
 *
 * @remarks SVG 必须挂在可测量 DOM 中，便于读取实际样式与长度。笔触为 G 笔配草稿手法，
 * 同一几何在重渲染与换主题后保持不变。
 */
export function sketchSvg(svg: SVGSVGElement): void {
	const view = svg.ownerDocument.defaultView;
	if (!view) throw new Error("图表 SVG 必须挂在浏览器文档中");
	const textPaths = Array.from(svg.querySelectorAll<SVGTextPathElement>("textPath"));
	// 替换元素前冻结样式，避免标签与相邻选择器随 DOM 结构变化。
	const shapes = Array.from(
		svg.querySelectorAll<Shape>("rect,line,path,circle,ellipse,polygon,polyline"),
	)
		.filter((shape) => !shape.closest("defs,clipPath,mask,marker,pattern,symbol,foreignObject"))
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
				lineWidth: syntheticStroke ? SYNTHETIC_WIDTH : Math.max(MIN_WIDTH, strokeWidth),
				// 连线锚定在节点边缘，端点不能被手法扰动
				pinEnds: true,
				style: dashed
					? DASHED
					: strokeWidth >= THICK_WIDTH && !syntheticStroke
						? THICK
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
		{ style: SKETCH },
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
