import rough from "roughjs";
import type { Options } from "roughjs/bin/core";
import type { RoughSVG } from "roughjs/bin/svg";

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

type Shape = SVGGraphicsElement;
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

function pin(element: SVGElement, property: string, value: string): void {
	if (value) {
		element.style.setProperty(
			property,
			value.replace(/url\(["']?[^)"']*#([^\s)"']+)["']?\)/g, 'url("#$1")'),
			"important",
		);
	}
}

function isPainted(paint: string, opacity: string): boolean {
	const transparent =
		paint === "none" ||
		paint === "transparent" ||
		(paint.startsWith("rgba(") && /,\s*0(?:\.0+)?\s*\)$/.test(paint)) ||
		/\/\s*0(?:\.0+)?\s*\)$/.test(paint);
	return !transparent && Number(opacity || 1) > 0;
}

function length(shape: Shape, style: CSSStyleDeclaration, name: string): number {
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

function drawShape(
	renderer: RoughSVG,
	shape: Shape,
	style: CSSStyleDeclaration,
	options: Options,
): SVGGElement {
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
			if (!rx || !ry) return renderer.rectangle(x, y, width, height, options);
			return renderer.path(
				`M${x + rx},${y}H${x + width - rx}A${rx},${ry} 0 0 1 ${x + width},${y + ry}V${y + height - ry}A${rx},${ry} 0 0 1 ${x + width - rx},${y + height}H${x + rx}A${rx},${ry} 0 0 1 ${x},${y + height - ry}V${y + ry}A${rx},${ry} 0 0 1 ${x + rx},${y}Z`,
				options,
			);
		}
		case "line":
			return renderer.line(value("x1"), value("y1"), value("x2"), value("y2"), options);
		case "circle":
			return renderer.circle(value("cx"), value("cy"), value("r") * 2, options);
		case "ellipse":
			return renderer.ellipse(
				value("cx"),
				value("cy"),
				value("rx") * 2,
				value("ry") * 2,
				options,
			);
		case "polygon":
			return renderer.polygon(points(shape), options);
		case "polyline": {
			const vertices = points(shape);
			return renderer.path(
				vertices.map(([x, y], index) => `${index ? "L" : "M"}${x},${y}`).join(""),
				options,
			);
		}
		default: {
			const cssPath = style.getPropertyValue("d").match(/^path\(["'](.*)["']\)$/);
			return renderer.path(cssPath?.[1] ?? shape.getAttribute("d") ?? "", options);
		}
	}
}

function decoratePaths(
	group: SVGGElement,
	style: CSSStyleDeclaration,
	options: Options,
	syntheticStroke: boolean,
): void {
	for (const path of group.querySelectorAll("path")) {
		const outline = path.getAttribute("stroke") !== "none";
		pin(path, "fill", outline ? "none" : (options.fill ?? "none"));
		pin(path, "stroke", outline ? (options.stroke ?? "none") : "none");
		pin(path, "stroke-width", outline ? String(options.strokeWidth) : "0");
		pin(path, "fill-opacity", style.getPropertyValue("fill-opacity") || "1");
		pin(
			path,
			"stroke-opacity",
			syntheticStroke
				? style.getPropertyValue("fill-opacity") || "1"
				: style.getPropertyValue("stroke-opacity") || "1",
		);
		pin(path, "fill-rule", style.getPropertyValue("fill-rule") || "nonzero");
		pin(path, "opacity", "1");
		pin(path, "filter", "none");
		pin(path, "transform", "none");
		pin(path, "clip-path", "none");
		pin(path, "mask", "none");
		pin(path, "shape-rendering", "geometricPrecision");
		for (const property of STROKE_PROPERTIES) {
			pin(path, property, style.getPropertyValue(property));
		}
		for (const property of MARKER_PROPERTIES) pin(path, property, "none");
	}
}

function preserveCarrier(
	shape: Shape,
	group: SVGGElement,
	style: CSSStyleDeclaration,
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
 * 原地转换已净化的可见 SVG 几何；保留 Mermaid 布局、箭头与文字引用。
 *
 * @remarks SVG 必须挂在可测量 DOM 中，便于读取实际样式与长度。
 */
export function sketchSvg(svg: SVGSVGElement): void {
	const renderer = rough.svg(svg);
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
			const style = svg.ownerDocument.createElementNS(SVG_NS, "g").style;
			for (const property of SNAPSHOT_PROPERTIES)
				style.setProperty(property, computed.getPropertyValue(property));
			return { shape, style };
		});
	for (const [index, { shape, style }] of shapes.entries()) {
		// 零尺寸矩形在 SVG 中不可见，不能被随机笔触变成散点。
		if (
			shape.localName === "rect" &&
			(length(shape, style, "width") <= 0 || length(shape, style, "height") <= 0)
		)
			continue;
		const fill = style.getPropertyValue("fill") || "black";
		const stroke = style.getPropertyValue("stroke") || "none";
		const fillVisible =
			shape.localName !== "line" && isPainted(fill, style.getPropertyValue("fill-opacity"));
		const strokeWidth = Number.parseFloat(style.getPropertyValue("stroke-width") || "1");
		const strokeVisible =
			strokeWidth > 0 && isPainted(stroke, style.getPropertyValue("stroke-opacity"));
		if (
			(!fillVisible && !strokeVisible) ||
			style.display === "none" ||
			Number(style.opacity || 1) === 0
		)
			continue;
		const syntheticStroke = !strokeVisible && fillVisible && !isBackingRect(shape, svg);
		const options: Options = {
			seed: index + 1,
			roughness: 2.2,
			maxRandomnessOffset: 2,
			bowing: 1.2,
			preserveVertices: true,
			disableMultiStroke: false,
			fillStyle: "solid",
			fillShapeRoughnessGain: 0,
			fill: fillVisible ? fill : undefined,
			stroke: syntheticStroke ? fill : strokeVisible ? stroke : "none",
			strokeWidth: syntheticStroke ? 1.25 : Math.max(1.25, strokeWidth),
		};
		const group = drawShape(renderer, shape, style, options);
		for (const attribute of Array.from(shape.attributes)) {
			if (!GEOMETRY_ATTRIBUTES[attribute.name]) {
				group.setAttributeNS(attribute.namespaceURI, attribute.name, attribute.value);
			}
		}
		for (const property of GROUP_PROPERTIES)
			pin(group, property, style.getPropertyValue(property));
		for (const property of MARKER_PROPERTIES) pin(group, property, "none");
		decoratePaths(group, style, options, syntheticStroke);
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
