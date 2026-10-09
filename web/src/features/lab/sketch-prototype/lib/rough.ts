import type { Palette, Scene } from "@violet/sketch";
import rough from "roughjs";

const NS = "http://www.w3.org/2000/svg";

function element<K extends keyof SVGElementTagNameMap>(
	tag: K,
	attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
	const node = document.createElementNS(NS, tag);
	for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
	return node;
}

function paintColor(palette: Palette, role: string): string {
	const color = palette[role];
	if (color === undefined) throw new Error(`未配置对照颜色：${role}`);
	return color;
}
/** Rough.js 对照使用相同场景与颜色；其生成耗时单独测量。 */
export function renderRoughScene(
	scene: Scene,
	palette: Palette,
	fillId = "solid",
	options: { seed?: number; width?: number } = {},
): SVGSVGElement {
	const svg = element("svg", {
		xmlns: NS,
		viewBox: `0 0 ${scene.width} ${scene.height}`,
		width: scene.width,
		height: scene.height,
		role: "img",
		"aria-label": "Rough.js 对照",
	});
	svg.style.width = "100%";
	svg.style.height = "auto";
	svg.style.display = "block";
	svg.append(
		element("rect", {
			width: scene.width,
			height: scene.height,
			fill: paintColor(palette, "paper"),
		}),
	);
	const renderer = rough.svg(svg);
	for (let i = 0; i < scene.items.length; i++) {
		const item = scene.items[i];
		const group = element("g", {});
		if (item.transform) group.setAttribute("transform", `matrix(${item.transform.join(" ")})`);
		if (item.geometry.commands.length)
			group.append(
				renderer.path(item.geometry.d, {
					seed: (options.seed ?? 42) + i,
					roughness: 2.2,
					maxRandomnessOffset: 2,
					bowing: 1.2,
					preserveVertices: true,
					disableMultiStroke: false,
					fillShapeRoughnessGain: 0,
					strokeWidth: options.width ?? 2.6,
					stroke:
						item.strokeRole === "none"
							? "none"
							: paintColor(palette, item.strokeRole ?? "ink"),
					fill: item.fillRole ? paintColor(palette, item.fillRole) : undefined,
					fillStyle: item.fill?.id ?? fillId,
				}),
			);
		if (item.label) {
			const label = element("text", {
				x: item.label.x,
				y: item.label.y,
				fill: paintColor(palette, "ink"),
				"font-size": item.label.size ?? 14,
				"font-family": "Arial, sans-serif",
				"text-anchor": "middle",
				"dominant-baseline": "middle",
			});
			label.textContent = item.label.text;
			group.append(label);
		}
		svg.append(group);
	}
	return svg;
}
