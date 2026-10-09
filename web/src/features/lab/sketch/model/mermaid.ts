import {
	CUBIC,
	ellipse,
	LINE,
	MOVE,
	type Path,
	pathFromSvg,
	polygon,
	polyline,
	rect,
} from "@violet/sketch";
import DOMPurify from "dompurify";
import mermaid from "mermaid";
import { type BenchItem, type BenchScene, tone } from "./scenes";

let renderId = 0;

/** 开放路径末端的实心三角箭头；方向取最后一段的切线。 */
function arrowHead(path: Path, size: number): Path | null {
	const { verbs, coords } = path;
	let c = 0;
	let x = 0;
	let y = 0;
	let tx = 0;
	let ty = 0;
	for (const verb of verbs) {
		if (verb === MOVE || verb === LINE) {
			tx = coords[c] - x;
			ty = coords[c + 1] - y;
			x = coords[c];
			y = coords[c + 1];
			c += 2;
		} else if (verb === CUBIC) {
			tx = coords[c + 4] - coords[c + 2];
			ty = coords[c + 5] - coords[c + 3];
			x = coords[c + 4];
			y = coords[c + 5];
			c += 6;
		}
	}
	const length = Math.hypot(tx, ty);
	if (!length) return null;
	const ux = tx / length;
	const uy = ty / length;
	const half = size * 0.42;
	return polygon([
		[x, y],
		[x - size * ux - half * uy, y - size * uy + half * ux],
		[x - size * ux + half * uy, y - size * uy - half * ux],
	]);
}

function flowchart(nodes: number): string {
	const columns = Math.max(2, Math.ceil(Math.sqrt(nodes)));
	const lines = ["flowchart TB"];
	for (let i = 0; i < nodes; i++) {
		lines.push(
			i % 7 === 3
				? `N${i}{Check ${i + 1}}`
				: i % 7 === 0
					? `N${i}([Step ${i + 1}])`
					: `N${i}[Step ${i + 1}]`,
		);
		if (i >= columns) lines.push(`N${i - columns} --> N${i}`);
		if (i >= columns && i % 4 === 2) lines.push(`N${i - columns + 1} --> N${i}`);
	}
	return lines.join("\n");
}

/**
 * 用真实 Mermaid 布局生成对照场景：图形、连线、箭头与文字位置均取自浏览器渲染结果。
 *
 * @remarks 只覆盖本页生成的 flowchart 所用元素；需要浏览器 DOM 与字体。
 */
export async function loadMermaidScene(nodes = 24): Promise<BenchScene> {
	mermaid.initialize({
		startOnLoad: false,
		securityLevel: "strict",
		theme: "neutral",
		htmlLabels: false,
		flowchart: { htmlLabels: false, curve: "basis", useMaxWidth: false },
	});
	const { svg: text } = await mermaid.render(`sketch-bench-${++renderId}`, flowchart(nodes));
	const clean = DOMPurify.sanitize(text, {
		USE_PROFILES: { svg: true, svgFilters: true },
		FORBID_TAGS: ["foreignObject", "image", "script"],
	});
	const parsed = new DOMParser().parseFromString(clean, "image/svg+xml");
	if (parsed.querySelector("parsererror")) throw new Error("Mermaid SVG 无法解析");
	const svg = document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement;
	const box = svg.viewBox.baseVal;
	if (!(box.width > 0 && box.height > 0)) throw new Error("Mermaid 布局缺少有效 viewBox");
	svg.setAttribute("width", String(box.width));
	svg.setAttribute("height", String(box.height));
	svg.style.cssText = "position:fixed;left:-20000px;top:0;visibility:hidden;max-width:none";
	document.body.append(svg);
	try {
		await document.fonts.ready;
		const root = svg.getCTM();
		if (!root) throw new Error("Mermaid 布局缺少根变换");
		const inverse = root.inverse();
		const items: BenchItem[] = [];
		let node = 0;
		for (const element of svg.querySelectorAll<SVGGraphicsElement>(
			"rect,circle,ellipse,line,polygon,polyline,path,text",
		)) {
			if (element.closest("defs,marker,clipPath,mask")) continue;
			const ctm = element.getCTM();
			if (!ctm) continue;
			const m = inverse.multiply(ctm);
			const transform = [m.a, m.b, m.c, m.d, m.e - box.x, m.f - box.y] as const;
			const tag = element.tagName.toLowerCase();
			const num = (name: string) => Number(element.getAttribute(name) ?? 0);
			if (tag === "text") {
				const rows = element.querySelectorAll<SVGGraphicsElement>(":scope > tspan");
				for (const row of rows.length ? rows : [element]) {
					const content = row.textContent?.trim();
					if (!content) continue;
					const b = row.getBBox();
					items.push({
						id: `label-${items.length}`,
						path: polyline([]),
						strokeRole: "none",
						transform,
						label: {
							text: content,
							x: b.x + b.width / 2,
							y: b.y + b.height / 2,
							size: Number.parseFloat(getComputedStyle(row).fontSize) || 16,
						},
					});
				}
				continue;
			}
			let path: Path;
			if (tag === "path")
				path = pathFromSvg(
					element.getAttribute("d") ?? "",
					element.getAttribute("fill-rule") === "evenodd" ? "evenodd" : "nonzero",
				);
			else if (tag === "rect")
				path = rect(num("x"), num("y"), num("width"), num("height"), num("rx"));
			else if (tag === "circle") path = ellipse(num("cx"), num("cy"), num("r"), num("r"));
			else if (tag === "ellipse") path = ellipse(num("cx"), num("cy"), num("rx"), num("ry"));
			else if (tag === "line")
				path = polyline([
					[num("x1"), num("y1")],
					[num("x2"), num("y2")],
				]);
			else {
				const values = (element.getAttribute("points") ?? "")
					.trim()
					.split(/[\s,]+/)
					.map(Number);
				const points = Array.from(
					{ length: values.length / 2 },
					(_, i) => [values[i * 2], values[i * 2 + 1]] as const,
				);
				path = polyline(points, tag === "polygon");
			}
			if (!path.verbs.length) continue;
			const style = getComputedStyle(element);
			if (style.display === "none") continue;
			const closed = path.verbs.includes(3);
			const filled =
				style.fill !== "none" &&
				style.fill !== "rgba(0, 0, 0, 0)" &&
				Number(style.fillOpacity) !== 0;
			const isNode = Boolean(element.closest(".node"));
			items.push({
				id: `shape-${items.length}`,
				path,
				transform,
				fillRole: filled && closed ? (isNode ? tone(node++) : "paper") : undefined,
				strokeRole: style.stroke === "none" ? "none" : "ink",
				// 连线锚定在节点边缘，端点不能被手法扰动。
				pinEnds: !closed,
			});
			if (tag === "path" && element.getAttribute("marker-end") && !closed) {
				const head = arrowHead(path, 9);
				if (head)
					items.push({
						id: `arrow-${items.length}`,
						path: head,
						transform,
						fillRole: "ink",
						fill: "solid",
						strokeRole: "none",
					});
			}
		}
		return { width: box.width, height: box.height, items };
	} finally {
		svg.remove();
	}
}
