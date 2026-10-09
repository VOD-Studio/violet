import { geometryFromCommands } from "./geometry.ts";
import type { Command, Contour, Fill, Geometry, InkLayer, PenContext } from "./types.ts";

interface Edge {
	minY: number;
	maxY: number;
	x: number;
	slope: number;
	winding: number;
}

interface Crossing {
	x: number;
	winding: number;
}

type Pattern = "hachure" | "cross-hatch" | "zigzag" | "dots" | "dashed" | "zigzag-line";

const MAX_SCAN_ROWS = 100000;

function scanSpans(
	contours: readonly Contour[],
	rule: Geometry["fillRule"],
	angle: number,
	gap: number,
	context: PenContext,
	visit: (left: number, right: number, y: number, row: number) => void,
): void {
	const c = Math.cos(angle),
		s = Math.sin(angle);
	const edges: Edge[] = [];
	for (const contour of contours) {
		const points = contour.points;
		// 与 SVG 填充一致，开放子路径也按首尾相连参与区域判定。
		for (let i = 0; i < points.length; i++) {
			const a = points[i],
				b = points[(i + 1) % points.length];
			const ax = c * a.x + s * a.y,
				ay = -s * a.x + c * a.y;
			const bx = c * b.x + s * b.y,
				by = -s * b.x + c * b.y;
			if (Math.abs(by - ay) < 1e-10) continue;
			edges.push({
				minY: Math.min(ay, by),
				maxY: Math.max(ay, by),
				x: ay < by ? ax : bx,
				slope: (bx - ax) / (by - ay),
				winding: by > ay ? 1 : -1,
			});
		}
	}
	if (!edges.length) return;
	edges.sort((a, b) => a.minY - b.minY);
	let next = 0,
		row = Math.ceil(edges[0].minY / gap),
		scanned = 0;
	let active: Edge[] = [];
	const crossings: Crossing[] = [];
	while (next < edges.length || active.length) {
		if (!active.length && next < edges.length)
			row = Math.max(row, Math.ceil(edges[next].minY / gap));
		const y = row * gap;
		if (++scanned > MAX_SCAN_ROWS) throw new RangeError("填充超过 100000 条扫描线；未降低密度");
		context.budget.addSamples(1);
		// 半开区间让共享顶点只计一次，水平边不参与交点计数。
		active = active.filter((edge) => edge.maxY > y);
		while (next < edges.length && edges[next].minY <= y) {
			const edge = edges[next++];
			if (edge.maxY > y) active.push(edge);
		}
		crossings.length = 0;
		for (const edge of active) {
			context.budget.addSamples(1);
			crossings.push({ x: edge.x + (y - edge.minY) * edge.slope, winding: edge.winding });
		}
		crossings.sort((a, b) => a.x - b.x);
		let winding = 0,
			parity = 0,
			left = 0;
		for (let i = 0; i < crossings.length; ) {
			const x = crossings[i].x;
			const wasInside = rule === "evenodd" ? parity !== 0 : winding !== 0;
			let delta = 0,
				count = 0;
			// 重合交点须合并更新奇偶性或绕数，避免生成虚假的内部区间。
			while (i < crossings.length && Math.abs(crossings[i].x - x) < 1e-9) {
				delta += crossings[i++].winding;
				count++;
			}
			winding += delta;
			parity = (parity + count) % 2;
			const isInside = rule === "evenodd" ? parity !== 0 : winding !== 0;
			if (!wasInside && isInside) left = x;
			else if (wasInside && !isInside && x - left > 1e-9) visit(left, x, y, row);
		}
		row++;
	}
}

function patternedFill(id: Pattern): Fill {
	return {
		id,
		generate(region, context) {
			if (!context.fillRole) return [];
			const gap = Math.max(6, context.width * 3.5);
			const contours = context.sample(region, gap / 2);
			const layers: InkLayer[] = [];
			const angles =
				id === "cross-hatch"
					? [-Math.PI / 4, Math.PI / 4]
					: [id === "dots" ? 0 : -Math.PI / 4];
			for (let pass = 0; pass < angles.length; pass++) {
				const angle = angles[pass],
					c = Math.cos(angle),
					s = Math.sin(angle);
				const commands: Command[] = [];
				let mark = 0;
				const point = (x: number, y: number): number[] => [c * x - s * y, s * x + c * y];
				const append = (command: Command) => {
					context.budget.addCommands(1);
					commands.push(command);
				};
				const move = (x: number, y: number) => append({ op: "M", values: point(x, y) });
				const line = (x: number, y: number) => append({ op: "L", values: point(x, y) });
				const segment = (left: number, right: number, y: number) => {
					const jitter =
						(context.random(`fill:${id}:${pass}:line`, mark++) - 0.5) * gap * 0.09;
					move(left, y + jitter);
					line(right, y - jitter);
				};
				scanSpans(contours, region.fillRule, angle, gap, context, (left, right, y, row) => {
					if (id === "hachure" || id === "cross-hatch") segment(left, right, y);
					else if (id === "dashed") {
						const period = gap * 1.7,
							dash = gap * 0.9;
						const offset = row % 2 ? period / 2 : 0;
						for (
							let x = Math.floor((left - offset) / period) * period + offset;
							x < right;
							x += period
						) {
							const a = Math.max(left, x),
								b = Math.min(right, x + dash);
							if (b > a) segment(a, b, y);
						}
					} else if (id === "dots") {
						const offset = row % 2 ? gap / 2 : 0;
						for (
							let x = Math.ceil((left - offset) / gap) * gap + offset;
							x <= right;
							x += gap
						) {
							const index = mark++;
							const px =
								x + (context.random("fill:dots:x", index) - 0.5) * gap * 0.15;
							const py =
								y + (context.random("fill:dots:y", index) - 0.5) * gap * 0.15;
							const r = Math.max(0.6, context.width * 0.48);
							move(px - r, py);
							append({ op: "A", values: [r, r, 0, 1, 0, ...point(px + r, py)] });
							append({ op: "A", values: [r, r, 0, 1, 0, ...point(px - r, py)] });
							append({ op: "Z", values: [] });
						}
					} else {
						const step = gap * 0.7,
							amplitude = gap * 0.28;
						if (id === "zigzag-line") {
							move(left, y);
							let tooth = 0;
							for (let x = left + step / 2; x < right; x += step / 2)
								line(x, y + (tooth++ % 2 ? -amplitude : amplitude));
							line(right, y);
						} else {
							// 独立折角与 zigzag-line 的连续折线采用不同的连接方式。
							for (let x = Math.floor(left / step) * step; x < right; x += step) {
								move(Math.max(left, x), y - amplitude);
								line(Math.min(right, Math.max(left, x + step / 2)), y + amplitude);
								line(Math.min(right, x + step * 0.88), y - amplitude);
							}
						}
					}
				});
				if (commands.length)
					layers.push({
						geometry: geometryFromCommands(commands),
						mode: id === "dots" ? "fill" : "stroke",
						role: context.fillRole,
						width: Math.max(0.7, context.width * 0.55),
						clip: region,
					});
			}
			return layers;
		},
	};
}

const solid: Fill = {
	id: "solid",
	generate(region, context) {
		if (!context.fillRole) return [];
		context.budget.addCommands(region.commands.length);
		return [{ geometry: region, mode: "fill", role: context.fillRole, clip: region }];
	},
};

/**
 * 提供实心、排线、交叉排线、独立折角、点阵、虚线及连续折线七种矢量填充。
 *
 * @remarks 未设置 fillRole 时返回空图层。纹理间距为 max(6, width×3.5) 场景单位，不随预算降低密度。
 * 扫描使用采样轮廓及原 fillRule；最终图层保留原区域 clip，渲染器须按同一规则裁剪完整笔墨以保留孔洞。
 * 采样扫描并非原曲线的精确区域求交，最终裁剪只能移除越界笔墨，不能补回漏生成的纹理。
 * @throws {@link RangeError} 当单次方向扫描超过 100000 行或几何采样达到硬限制。
 * @throws 当共享预算耗尽时，传播 budget 抛出的错误。
 */
export const fills: readonly Fill[] = [
	solid,
	patternedFill("hachure"),
	patternedFill("cross-hatch"),
	patternedFill("zigzag"),
	patternedFill("dots"),
	patternedFill("dashed"),
	patternedFill("zigzag-line"),
];
