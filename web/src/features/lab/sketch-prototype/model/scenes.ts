import { comicPalette, comicScene } from "@features/lab/sketch-prototype/model/comic-scene";
import type { Geometry, Palette, Scene, SceneItem } from "@violet/sketch";
import {
	arrowForPath,
	circleGeometry,
	fills,
	geometryFromCommands,
	geometryFromPath,
	polyline,
	rectangleGeometry,
	waveGeometry,
} from "@violet/sketch";
import DOMPurify from "dompurify";
import mermaid from "mermaid";

export const defaultPalette: Palette = {
	...comicPalette,
	paper: "#fffdf5",
	blue: "#b9dbea",
	rose: "#f4bcc4",
	mint: "#b9d9c0",
	violet: "#cfc2e9",
	gold: "#f0cf8a",
	ink: "#353343",
};
const solidFill = fills.find((fill) => fill.id === "solid");

const primitiveScene: Scene = {
	width: 960,
	height: 640,
	items: [
		{
			id: "line",
			geometry: geometryFromPath("M52 86L248 86"),
			label: { text: "line", x: 150, y: 133 },
		},
		{
			id: "rectangle",
			geometry: rectangleGeometry(350, 36, 180, 80),
			fillRole: "blue",
			label: { text: "rectangle", x: 440, y: 145 },
		},
		{
			id: "ellipse",
			geometry: geometryFromPath("M677 80A92 45 0 1 0 861 80A92 45 0 1 0 677 80Z"),
			fillRole: "rose",
			label: { text: "ellipse", x: 770, y: 145 },
		},
		{
			id: "circle",
			geometry: circleGeometry(150, 255, 65),
			fillRole: "mint",
			label: { text: "circle", x: 150, y: 347 },
		},
		{
			id: "linear-path",
			geometry: polyline([
				{ x: 350, y: 282 },
				{ x: 390, y: 220 },
				{ x: 445, y: 270 },
				{ x: 500, y: 195 },
				{ x: 545, y: 282 },
			]),
			label: { text: "linearPath", x: 440, y: 347 },
		},
		{
			id: "polygon",
			geometry: geometryFromPath("M770 187L852 235L823 306L717 306L688 235Z"),
			fillRole: "violet",
			label: { text: "polygon", x: 770, y: 347 },
		},
		{
			id: "arc",
			geometry: geometryFromPath("M58 469A92 68 18 1 1 227 501"),
			label: { text: "arc · exact SVG A", x: 150, y: 581 },
		},
		{
			id: "curve",
			geometry: geometryFromPath("M346 495C380 365 420 581 455 456Q505 390 549 515"),
			label: { text: "curve · cubic / quadratic", x: 450, y: 581 },
		},
		{
			id: "path",
			geometry: geometryFromPath(
				"m692 475q24-88 75-26t80 24a28 19 23 0 1-41 44h-55v-28s-25-22-59-14z",
			),
			fillRole: "gold",
			label: { text: "path · relative / S / T / H / V", x: 770, y: 581, size: 14 },
		},
	],
};

export const holeScene: Scene = {
	width: 960,
	height: 390,
	items: [
		{
			id: "evenodd",
			geometry: geometryFromPath("M35 40H305V290H35ZM105 110H235V220H105Z", "evenodd"),
			fillRole: "blue",
			label: { text: "evenodd · same winding → hole", x: 170, y: 345, size: 15 },
		},
		{
			id: "nonzero-filled",
			geometry: geometryFromPath("M345 40H615V290H345ZM415 110H545V220H415Z", "nonzero"),
			fillRole: "rose",
			label: { text: "nonzero · same winding → filled", x: 480, y: 345, size: 15 },
		},
		{
			id: "nonzero-hole",
			geometry: geometryFromPath("M655 40H925V290H655ZM725 110V220H855V110Z", "nonzero"),
			fillRole: "mint",
			label: { text: "nonzero · reverse winding → hole", x: 790, y: 345, size: 15 },
		},
	],
};

const flowing = geometryFromPath("M65 160C150 15 265 260 350 120S520 60 610 155");
const decorationScene: Scene = {
	width: 960,
	height: 610,
	items: [
		{
			id: "flowing",
			geometry: flowing,
			label: { text: "Arrow tip follows the original endpoint", x: 340, y: 246 },
		},
		{
			id: "arrow",
			geometry: arrowForPath(flowing, 22),
			fillRole: "ink",
			fill: solidFill,
			strokeRole: "none",
		},
		{ id: "bracket-left", geometry: geometryFromPath("M110 330H70V510H110") },
		{ id: "bracket-right", geometry: geometryFromPath("M545 330H585V510H545") },
		{
			id: "annotation",
			geometry: rectangleGeometry(155, 354, 345, 135, 12),
			fillRole: "blue",
			label: { text: "precise skeleton / expressive ink", x: 327, y: 420, size: 17 },
		},
		{ id: "underline", geometry: geometryFromPath("M171 456Q325 462 486 454") },
		{
			id: "wave",
			geometry: waveGeometry(660, 390, 220, 14),
			label: { text: "wave decoration", x: 770, y: 444 },
		},
		{
			id: "zero-derivative",
			geometry: geometryFromPath("M664 533C835 423 835 423 664 533"),
			label: { text: "cusp / exact reversal", x: 770, y: 578, size: 15 },
		},
	],
};

const handwritingScene: Scene = {
	width: 960,
	height: 560,
	items: [
		{
			id: "hand-d",
			geometry: geometryFromPath(
				"M245 93C235 180 211 324 166 359C117 397 63 348 101 304C141 259 211 266 194 315C181 353 139 380 143 411C145 440 190 420 235 375",
			),
			label: { text: "pressure profile · angle and aspect are independent", x: 460, y: 500 },
		},
		{
			id: "hand-r",
			geometry: geometryFromPath(
				"M233 377C261 345 274 303 284 290C308 264 326 284 301 314C284 335 281 365 314 375C345 382 367 343 383 319",
			),
		},
		{
			id: "hand-a",
			geometry: geometryFromPath(
				"M468 290C414 267 364 323 383 361C405 405 464 353 477 298C463 346 447 390 481 382C510 376 528 344 544 320",
			),
		},
		{
			id: "hand-w",
			geometry: geometryFromPath(
				"M548 288C514 349 523 394 558 375C579 362 593 332 603 298C584 350 586 402 624 378C655 358 659 295 687 285C714 269 723 301 707 333C688 369 729 382 789 354",
			),
		},
		{
			id: "crossing",
			geometry: geometryFromPath(
				"M752 116C608 51 597 227 746 219C889 212 869 54 752 116C659 164 683 232 864 189",
			),
			label: { text: "self crossing", x: 763, y: 256, size: 16 },
		},
		{
			id: "sharp-turn",
			geometry: geometryFromPath("M325 177L414 77L415 178L508 78L506 179L604 78"),
			label: { text: "sharp corners / no miter spikes", x: 462, y: 222, size: 15 },
		},
	],
};

export const sceneFixtures: { key: string; title: string; scene: Scene }[] = [
	{ key: "comic", title: "完整彩色漫画", scene: comicScene },
	{ key: "primitives", title: "九种基础图元与完整路径", scene: primitiveScene },
	{ key: "holes", title: "复合路径 · 两种孔洞规则", scene: holeScene },
	{ key: "handwriting", title: "书写压感 · 转折与交叉", scene: handwritingScene },
	{ key: "decorations", title: "箭头 · 括号 · 下划线 · 波浪", scene: decorationScene },
];

/** 不含 Mermaid 布局成本的确定性网格压力场景。 */
export function makeStressScene(nodes: number): Scene {
	const columns = Math.ceil(Math.sqrt(nodes));
	const rows = Math.ceil(nodes / columns);
	const items: SceneItem[] = [];
	for (let i = 0; i < nodes; i++) {
		const x = 32 + (i % columns) * 142,
			y = 32 + Math.floor(i / columns) * 96;
		items.push({
			id: `node-${i}`,
			geometry: rectangleGeometry(x, y, 106, 58, 9),
			fillRole: i % 2 ? "blue" : "mint",
			label: { text: String(i + 1), x: x + 53, y: y + 31 },
		});
		if (i + columns < nodes)
			items.push({
				id: `edge-${i}`,
				geometry: geometryFromPath(
					`M${x + 53} ${y + 58}C${x + 53} ${y + 72} ${x + 53} ${y + 83} ${x + 53} ${y + 96}`,
				),
			});
	}
	return { width: columns * 142 + 40, height: rows * 96 + 20, items };
}

let mermaidId = 0;

/** 在浏览器读取真实 Mermaid 原生布局；支持本原型生成的 flowchart 图元、标签和箭头。 */
export async function loadMermaidScene(nodes = 24): Promise<Scene> {
	const count = Math.max(2, Math.min(1000, Math.trunc(nodes)));
	const columns = Math.max(2, Math.ceil(Math.sqrt(count)));
	const source = ["flowchart TB"];
	for (let i = 0; i < count; i++) {
		source.push(
			i % 7 === 3
				? `N${i}{Check ${i + 1}}`
				: i % 7 === 0
					? `N${i}([Step ${i + 1}])`
					: `N${i}[Step ${i + 1}]`,
		);
		if (i >= columns) source.push(`N${i - columns} --> N${i}`);
		if (i >= columns && i % 4 === 2) source.push(`N${i - columns + 1} --> N${i}`);
	}
	mermaid.initialize({
		startOnLoad: false,
		securityLevel: "strict",
		theme: "neutral",
		look: "classic",
		htmlLabels: false,
		flowchart: { htmlLabels: false, curve: "basis", useMaxWidth: false },
	});
	const { svg: text } = await mermaid.render(`sketch-layout-${++mermaidId}`, source.join("\n"));
	const clean = DOMPurify.sanitize(text, {
		USE_PROFILES: { svg: true, svgFilters: true },
		FORBID_TAGS: ["foreignObject", "image", "script"],
	});
	const parsed = new DOMParser().parseFromString(clean, "image/svg+xml");
	if (parsed.querySelector("parsererror")) throw new Error("Mermaid SVG could not be parsed");
	const svg = document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement;
	const box = svg.viewBox.baseVal;
	if (!(box.width > 0 && box.height > 0)) throw new Error("Mermaid layout has no finite viewBox");
	svg.setAttribute("width", String(box.width));
	svg.setAttribute("height", String(box.height));
	svg.style.cssText = "position:fixed;left:-20000px;top:0;visibility:hidden;max-width:none";
	document.body.append(svg);
	try {
		await document.fonts.ready;
		const root = svg.getCTM();
		if (!root) throw new Error("Mermaid layout has no root transform");
		const items: SceneItem[] = [];
		let nodeIndex = 0;
		for (const element of svg.querySelectorAll<SVGGraphicsElement>(
			"rect,circle,ellipse,line,polygon,polyline,path,text",
		)) {
			if (element.closest("defs,marker,clipPath,mask")) continue;
			const matrix = element.getCTM();
			if (!matrix) continue;
			const relative = root.inverse().multiply(matrix);
			const transform: SceneItem["transform"] = [
				relative.a,
				relative.b,
				relative.c,
				relative.d,
				relative.e - box.x,
				relative.f - box.y,
			];
			const tag = element.tagName.toLowerCase();
			const number = (name: string) => Number(element.getAttribute(name) ?? 0);
			if (tag === "text") {
				const rows = element.querySelectorAll<SVGGraphicsElement>(":scope > tspan");
				for (const label of rows.length ? rows : [element]) {
					const textContent = label.textContent?.trim();
					if (!textContent) continue;
					const bounds = label.getBBox();
					items.push({
						id: `mermaid-label-${items.length}`,
						geometry: geometryFromCommands([]),
						strokeRole: "none",
						transform,
						label: {
							text: textContent,
							x: bounds.x + bounds.width / 2,
							y: bounds.y + bounds.height / 2,
							size: Number.parseFloat(getComputedStyle(label).fontSize) || 16,
						},
					});
				}
				continue;
			}
			let geometry: Geometry;
			if (tag === "path")
				geometry = geometryFromPath(
					element.getAttribute("d") ?? "",
					element.getAttribute("fill-rule") === "evenodd" ? "evenodd" : "nonzero",
				);
			else if (tag === "rect")
				geometry = rectangleGeometry(
					number("x"),
					number("y"),
					number("width"),
					number("height"),
					number("rx"),
				);
			else if (tag === "circle")
				geometry = circleGeometry(number("cx"), number("cy"), number("r"));
			else if (tag === "ellipse")
				geometry = geometryFromCommands([
					{ op: "M", values: [number("cx") - number("rx"), number("cy")] },
					{
						op: "A",
						values: [
							number("rx"),
							number("ry"),
							0,
							1,
							0,
							number("cx") + number("rx"),
							number("cy"),
						],
					},
					{
						op: "A",
						values: [
							number("rx"),
							number("ry"),
							0,
							1,
							0,
							number("cx") - number("rx"),
							number("cy"),
						],
					},
					{ op: "Z", values: [] },
				]);
			else if (tag === "line")
				geometry = polyline([
					{ x: number("x1"), y: number("y1") },
					{ x: number("x2"), y: number("y2") },
				]);
			else {
				const coordinates = (element.getAttribute("points") ?? "")
					.trim()
					.split(/[\s,]+/)
					.map(Number);
				geometry = polyline(
					Array.from({ length: coordinates.length / 2 }, (_, i) => ({
						x: coordinates[i * 2],
						y: coordinates[i * 2 + 1],
					})),
					tag === "polygon",
				);
			}
			if (!geometry.commands.length) continue;
			const style = getComputedStyle(element);
			if (style.display === "none" || style.visibility === "collapse") continue;
			const filled =
				style.fill !== "none" &&
				style.fill !== "rgba(0, 0, 0, 0)" &&
				Number(style.fillOpacity) !== 0;
			items.push({
				id: `mermaid-shape-${items.length}`,
				geometry,
				transform,
				fillRole:
					filled && geometry.closed
						? element.closest(".node")
							? ["blue", "mint", "rose", "violet"][nodeIndex++ % 4]
							: "paper"
						: undefined,
				strokeRole: style.stroke === "none" ? "none" : "ink",
			});
			if (tag === "path" && element.getAttribute("marker-end") && !geometry.closed) {
				items.push({
					id: `mermaid-arrow-${items.length}`,
					geometry: arrowForPath(geometry, 9),
					transform,
					fillRole: "ink",
					fill: solidFill,
					strokeRole: "none",
				});
			}
		}
		return { width: box.width, height: box.height, items };
	} finally {
		svg.remove();
	}
}
