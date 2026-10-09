import { geometryFromCommands } from "../geometry.ts";
import type { Command, DrawnScene, Geometry, InkLayer, Palette } from "../types.ts";
import { paintColor } from "./palette.ts";

const NS = "http://www.w3.org/2000/svg";
let serial = 0;
interface SvgTrack {
	group: SVGGElement;
	paint: SVGPathElement;
	masks?: SVGPathElement[];
	layer: InkLayer;
	item: number;
}
const svgModels = new WeakMap<
	SVGSVGElement,
	{ tracks: SvgTrack[]; labels: { node: SVGTextElement; item: number }[] }
>();
const nativeContours = new WeakMap<Geometry, readonly string[]>();

function element<K extends keyof SVGElementTagNameMap>(
	tag: K,
	attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
	const node = document.createElementNS(NS, tag);
	for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
	return node;
}

/**
 * 将生成结果构造成尚未挂载的纯矢量 SVG 元素。
 *
 * @param palette - 须包含全部图层颜色角色及 paper/ink；缺失角色会抛出错误。
 * @param prefix - 内部 clip/mask 标识前缀，函数会追加实例序号防止同页冲突。
 * @returns 可挂载或独立序列化的 SVG；创建时展示完整画面，不启动动画。
 * @remarks 需要浏览器 document；函数不写入页面，不重新生成笔迹。
 */
export function mountSvg(
	drawn: DrawnScene,
	palette: Palette,
	prefix = "sketch-prototype",
): SVGSVGElement {
	const id = `${prefix}-${++serial}`;
	const svg = element("svg", {
		xmlns: NS,
		viewBox: `0 0 ${drawn.width} ${drawn.height}`,
		width: drawn.width,
		height: drawn.height,
		role: "img",
		"aria-label": "手绘原型画面",
	});
	svg.style.width = "100%";
	svg.style.height = "auto";
	svg.style.display = "block";
	const defs = element("defs", {});
	svg.append(
		defs,
		element("rect", {
			width: drawn.width,
			height: drawn.height,
			fill: paintColor(palette, "paper"),
			"data-role": "paper",
		}),
	);
	const tracks: SvgTrack[] = [],
		labels: { node: SVGTextElement; item: number }[] = [];
	for (let i = 0; i < drawn.items.length; i++) {
		const item = drawn.items[i];
		const root = element("g", { "data-item": item.id });
		if (item.transform) root.setAttribute("transform", `matrix(${item.transform.join(" ")})`);
		for (let j = 0; j < item.layers.length; j++) {
			const layer = item.layers[j];
			const group = element("g", {});
			if (layer.clip) {
				const clipId = `${id}-clip-${i}-${j}`;
				const clip = element("clipPath", { id: clipId, clipPathUnits: "userSpaceOnUse" });
				clip.append(
					element("path", {
						d: layer.clip.d,
						"clip-rule": layer.clip.fillRule,
						"fill-rule": layer.clip.fillRule,
					}),
				);
				defs.append(clip);
				group.setAttribute("clip-path", `url(#${clipId})`);
			}
			let masks: SVGPathElement[] | undefined;
			if (layer.reveal) {
				const maskId = `${id}-mask-${i}-${j}`;
				const b = layer.geometry.bounds,
					padding = (layer.revealWidth ?? 20) * 2;
				const maskNode = element("mask", {
					id: maskId,
					maskUnits: "userSpaceOnUse",
					x: b.x - padding,
					y: b.y - padding,
					width: b.width + padding * 2,
					height: b.height + padding * 2,
				});
				let paths = nativeContours.get(layer.reveal);
				if (!paths) {
					const chunks: Command[][] = [];
					for (const command of layer.reveal.commands) {
						if (command.op === "M" || !chunks.length) chunks.push([]);
						chunks[chunks.length - 1].push(command);
					}
					paths =
						chunks.length === 1
							? [layer.reveal.d]
							: chunks.map((chunk) => geometryFromCommands(chunk).d);
					nativeContours.set(layer.reveal, paths);
				}
				masks = paths.map((d) =>
					element("path", {
						d,
						fill: "none",
						stroke: "white",
						"stroke-width": layer.revealWidth ?? 20,
						"stroke-linecap": "round",
						"stroke-linejoin": "round",
						pathLength: 1,
						"stroke-dasharray": "1 1",
						"stroke-dashoffset": 0,
					}),
				);
				maskNode.append(...masks);
				defs.append(maskNode);
				group.setAttribute("mask", `url(#${maskId})`);
			}
			const paint = element("path", {
				d: layer.geometry.d,
				"data-role": layer.role,
				"data-mode": layer.mode,
				opacity: layer.opacity ?? 1,
				"fill-rule": layer.geometry.fillRule,
			});
			if (layer.mode === "fill") paint.setAttribute("fill", paintColor(palette, layer.role));
			else {
				paint.setAttribute("fill", "none");
				paint.setAttribute("stroke", paintColor(palette, layer.role));
				paint.setAttribute("stroke-width", String(layer.width ?? 1));
				paint.setAttribute("stroke-linecap", "round");
				paint.setAttribute("stroke-linejoin", "round");
			}
			group.append(paint);
			root.append(group);
			tracks.push({ group, paint, masks, layer, item: i });
		}
		if (item.label) {
			const text = element("text", {
				x: item.label.x,
				y: item.label.y,
				fill: paintColor(palette, "ink"),
				"data-role": "ink",
				"text-anchor": "middle",
				"dominant-baseline": "middle",
				"font-family": "Arial, sans-serif",
				"font-size": item.label.size ?? 14,
			});
			text.textContent = item.label.text;
			root.append(text);
			labels.push({ node: text, item: i });
		}
		svg.append(root);
	}
	svgModels.set(svg, { tracks, labels });
	return svg;
}

/**
 * 更新 SVG 的颜色角色，不改变几何或重新生成随机笔迹。
 *
 * @param svg - 由 mountSvg 创建的元素；颜色通过其 data-role 属性定位。
 * @throws 当 palette 缺少元素引用的颜色角色。
 * @remarks 更新逐元素执行；发生错误前已更新的属性不会回滚。
 */
export function updateSvgPalette(svg: SVGSVGElement, palette: Palette): void {
	for (const node of svg.querySelectorAll<SVGElement>("[data-role]")) {
		const role = node.getAttribute("data-role");
		if (!role) continue;
		node.setAttribute(
			node.getAttribute("data-mode") === "stroke" ? "stroke" : "fill",
			paintColor(palette, role),
		);
	}
}

/**
 * 将统一进度应用到 SVG 笔墨显现遮罩和区域透明度。
 *
 * @param svg - 当前实例中由 mountSvg 创建的原始元素；克隆或重新解析的 SVG 不带运行时映射。
 * @param drawn - 必须是创建该 SVG 时的生成结果。
 * @param progress - 归一化进度；各图元最终进度会钳制到 [0, 1]。
 * @param sequential - true 按图元数量均分进度；false 让各图元并行显现。
 * @remarks 不拥有时钟或播放状态；同一图元内的图层共享进度，未管理的 SVG 不执行更新。
 */
export function updateSvgProgress(
	svg: SVGSVGElement,
	drawn: DrawnScene,
	progress: number,
	sequential: boolean,
): void {
	const model = svgModels.get(svg);
	if (!model) return;
	for (const track of model.tracks) {
		const p = Math.max(
			0,
			Math.min(1, sequential ? progress * drawn.items.length - track.item : progress),
		);
		track.group.setAttribute("opacity", String(track.masks ? (p > 0 ? 1 : 0) : p));
		if (track.masks)
			for (const mask of track.masks) mask.setAttribute("stroke-dashoffset", String(1 - p));
	}
	for (const label of model.labels) {
		const p = Math.max(
			0,
			Math.min(1, sequential ? progress * drawn.items.length - label.item : progress),
		);
		label.node.setAttribute("opacity", String(p));
	}
}
