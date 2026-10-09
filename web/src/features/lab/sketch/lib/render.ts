import type { BenchScene } from "@features/lab/sketch/model/scenes";
import {
	createSchedule,
	type Drawing,
	draw,
	fills,
	type Palette,
	type Schedule,
	type ScheduleMode,
	type Style,
} from "@violet/sketch";
import { mountSvg, pathData } from "@violet/sketch/svg";
import rough from "roughjs";

const NS = "http://www.w3.org/2000/svg";

/** 一侧渲染的度量：耗时含生成与 DOM 构建，字节为序列化后的 SVG。 */
export interface PaneStats {
	ms: number;
	bytes: number;
	paths: number;
}

interface Options {
	seed: number;
	width: number;
}

function color(palette: Palette, role: string): string {
	const value = palette[role];
	if (value === undefined) throw new Error(`未配置颜色：${role}`);
	return value;
}

function measure(svg: SVGSVGElement, ms: number): PaneStats {
	return {
		ms,
		bytes: new XMLSerializer().serializeToString(svg).length,
		paths: svg.querySelectorAll("path").length,
	};
}

/**
 * 用站点 Mermaid 线上配方渲染 Rough.js 对照。
 *
 * @remarks 与线上一致：roughness 2.2、bowing 1.2、双笔复画；同一 seed 按图元序号偏移。
 */
export function renderRough(scene: BenchScene, palette: Palette, { seed, width }: Options) {
	const started = performance.now();
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("viewBox", `0 0 ${scene.width} ${scene.height}`);
	svg.setAttribute("role", "img");
	const paper = document.createElementNS(NS, "rect");
	paper.setAttribute("width", String(scene.width));
	paper.setAttribute("height", String(scene.height));
	paper.setAttribute("fill", color(palette, "paper"));
	svg.append(paper);
	const renderer = rough.svg(svg);
	scene.items.forEach((item, i) => {
		const group = document.createElementNS(NS, "g");
		if (item.transform) group.setAttribute("transform", `matrix(${item.transform.join(" ")})`);
		if (item.path.verbs.length)
			group.append(
				renderer.path(pathData(item.path.verbs, item.path.coords, 3), {
					seed: seed + i,
					roughness: 2.2,
					maxRandomnessOffset: 2,
					bowing: 1.2,
					preserveVertices: true,
					disableMultiStroke: false,
					fillShapeRoughnessGain: 0,
					strokeWidth: width,
					stroke:
						item.strokeRole === "none"
							? "none"
							: color(palette, item.strokeRole ?? "ink"),
					fill: item.fillRole ? color(palette, item.fillRole) : undefined,
					fillStyle: item.fill ?? "solid",
				}),
			);
		if (item.label) {
			const text = document.createElementNS(NS, "text");
			text.setAttribute("x", String(item.label.x));
			text.setAttribute("y", String(item.label.y));
			text.setAttribute("fill", color(palette, "ink"));
			text.setAttribute("font-size", String(item.label.size ?? 14));
			text.setAttribute("font-family", "system-ui, sans-serif");
			text.setAttribute("text-anchor", "middle");
			text.setAttribute("dominant-baseline", "middle");
			text.textContent = item.label.text;
			group.append(text);
		}
		svg.append(group);
	});
	return { svg, stats: measure(svg, performance.now() - started) };
}

/** 按所选风格生成本库结果；图元的 fill 覆盖风格的默认填充。 */
export function drawSketch(scene: BenchScene, style: Style, { seed, width }: Options): Drawing {
	return draw(
		{
			width: scene.width,
			height: scene.height,
			items: scene.items.map(({ fill, ...item }) => ({
				...item,
				style: fill ? { ...style, fill: fills[fill] } : undefined,
			})),
		},
		{ style, seed, width },
	);
}

export interface SketchSvgResult {
	svg: SVGSVGElement;
	drawing: Drawing;
	schedule: Schedule;
	stats: PaneStats;
}

/** 生成并构建带时间轴的 SVG，耗时与 Rough.js 一侧同口径。 */
export function renderSketchSvg(
	scene: BenchScene,
	style: Style,
	palette: Palette,
	options: Options,
	mode: ScheduleMode,
): SketchSvgResult {
	const started = performance.now();
	const drawing = drawSketch(scene, style, options);
	const schedule = createSchedule(drawing, { mode });
	const svg = mountSvg(drawing, palette, { idPrefix: "bench", schedule });
	return { svg, drawing, schedule, stats: measure(svg, performance.now() - started) };
}

/** 生成结果与首帧耗时；Canvas 之后按时间重绘同一结果。 */
export function prepareSketchCanvas(
	scene: BenchScene,
	style: Style,
	palette: Palette,
	options: Options,
	mode: ScheduleMode,
) {
	const started = performance.now();
	const drawing = drawSketch(scene, style, options);
	const schedule = createSchedule(drawing, { mode });
	const generateMs = performance.now() - started;
	const stats = measure(mountSvg(drawing, palette, { idPrefix: "stat" }), generateMs);
	return { drawing, schedule, stats };
}
