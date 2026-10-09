import { geometryFromCommands } from "../geometry.ts";
import type { Command, Geometry, InkLayer, Pen, PenContext } from "../types.ts";

/** 铅笔专属的固定纹理配置，不随场景预算改变。 */
export interface PencilOptions {
	/** 非负整数；0 关闭纤维，1 仅沿中心生成，默认 7。 */
	fiberCount?: number;
	/** 每平方场景单位的颗粒数；以弧长 × 名义线宽估计覆盖面积，0 关闭颗粒，默认 0.35。 */
	grainDensity?: number;
}

/**
 * 沿骨架生成断续石墨纤维与分透明度的矢量颗粒。
 *
 * @returns 共用原始骨架显露范围的笔迹层；相同输入与随机源产生相同结果。
 * @remarks
 * 每条轮廓的颗粒数为 ceil(弧长 × 线宽 × grainDensity)，与骨架分段数量独立。
 * 这是调用方选择的固定纹理配方，不随命令预算或设备速度减少颗粒。
 * 骨架仍按 context.precision 采样，纤维保留全部可见采样顶点，不额外放宽误差；
 * 颗粒位置以采样折线弧长为准，不保证原曲线的精确弧长或偏移轮廓误差。
 * 骨架点与颗粒分别计入采样预算，实际输出命令计入命令预算，超限不删减纹理。
 * @throws 输入宽度或精度非正有限数、颗粒坐标溢出或共享预算超限时抛出错误。
 */
export function createPencilPen(options: PencilOptions = {}): Pen {
	const fiberCount = options.fiberCount ?? 7;
	const grainDensity = options.grainDensity ?? 0.35;
	if (
		!Number.isInteger(fiberCount) ||
		fiberCount < 0 ||
		!Number.isFinite(grainDensity) ||
		grainDensity < 0
	) {
		throw new RangeError(
			"Pencil requires a nonnegative integer fiber count and finite nonnegative grain density",
		);
	}
	return {
		id: "pencil",
		generate(geometry: Geometry, context: PenContext) {
			if (
				!Number.isFinite(context.width) ||
				context.width <= 0 ||
				!Number.isFinite(context.precision) ||
				context.precision <= 0
			) {
				throw new RangeError(
					"Pencil generation requires positive finite width and precision",
				);
			}
			const contours = context.sample(
				geometry,
				Math.max(0.5, Math.min(2.5, context.width * 0.6)),
			);
			const layers: InkLayer[] = [];
			const revealWidth = context.width * 1.5 + context.precision * 2;

			for (let fiber = 0; fiber < fiberCount; fiber++) {
				const commands: Command[] = [];
				const offset =
					fiberCount === 1 ? 0 : (fiber / (fiberCount - 1) - 0.5) * context.width * 0.95;
				const phase = context.random("pencil-fiber-phase", fiber) * Math.PI * 2;
				const period = 6 + context.random("pencil-fiber-period", fiber) * 8;
				const width =
					context.width * (0.045 + context.random("pencil-fiber-width", fiber) * 0.025);
				const opacity = 0.32 + context.random("pencil-fiber-opacity", fiber) * 0.22;

				for (let contourIndex = 0; contourIndex < contours.length; contourIndex++) {
					const contour = contours[contourIndex];
					let running = false;
					let pendingMove = false;
					let startX = 0;
					let startY = 0;
					let previousTx = 0;
					let previousTy = 0;
					const channel = `pencil-fiber-coverage:${contourIndex}:${fiber}`;
					const driftChannel = `pencil-fiber-drift:${contourIndex}:${fiber}`;
					for (const point of contour.points) {
						const cell = Math.floor(point.s / period);
						const dropout =
							context.random(channel, cell) <
							(fiber === 0 || fiber === fiberCount - 1 ? 0.23 : 0.12);
						if (dropout) {
							running = false;
							continue;
						}
						const fraction = point.s / period - cell;
						const blend = fraction * fraction * (3 - 2 * fraction);
						const startDrift = context.random(driftChannel, cell) - 0.5;
						const endDrift = context.random(driftChannel, cell + 1) - 0.5;
						const drift =
							context.width *
							(0.05 * (startDrift + (endDrift - startDrift) * blend) +
								0.025 * Math.sin(point.s * 0.4 + phase));
						const distance = offset + drift;
						const x = point.x - point.ty * distance;
						const y = point.y + point.tx * distance;
						// 尖角处断开纤维，避免相反的偏移法线相连。
						const corner =
							running && previousTx * point.tx + previousTy * point.ty < 0.4;
						if (!running || corner) {
							startX = x;
							startY = y;
							pendingMove = true;
						} else {
							// 没有后续线段的孤立 M 不产生笔迹，也不占命令预算。
							context.budget.addCommands(pendingMove ? 2 : 1);
							if (pendingMove) {
								commands.push({ op: "M", values: [startX, startY] });
								pendingMove = false;
							}
							commands.push({ op: "L", values: [x, y] });
						}
						running = true;
						previousTx = point.tx;
						previousTy = point.ty;
					}
				}
				if (commands.length)
					layers.push({
						geometry: geometryFromCommands(commands),
						mode: "stroke",
						role: context.strokeRole,
						width,
						opacity,
						reveal: geometry,
						revealWidth,
					});
			}

			const grainBands: Command[][] = [[], [], []];
			let grainIndex = 0;
			for (const contour of contours) {
				if (!contour.points.length) continue;
				const count = Math.ceil(contour.length * context.width * grainDensity);
				let segment = 0;
				for (let grain = 0; grain < count; grain++) {
					context.budget.addSamples(1);
					const index = grainIndex++;
					const s =
						((grain + context.random("pencil-grain-position", index)) / count) *
						contour.length;
					while (segment < contour.points.length - 2 && contour.points[segment + 1].s < s)
						segment++;
					const a = contour.points[segment];
					const b = contour.points[Math.min(segment + 1, contour.points.length - 1)];
					const dx = b.x - a.x;
					const dy = b.y - a.y;
					const length = b.s - a.s;
					const t = length > 0 ? (s - a.s) / length : 0;
					const tx = length > 0 ? dx / length : a.tx;
					const ty = length > 0 ? dy / length : a.ty;
					const lateral =
						(context.random("pencil-grain-lateral-a", index) +
							context.random("pencil-grain-lateral-b", index) -
							1) *
						context.width *
						0.52;
					const x = a.x + dx * t - ty * lateral;
					const y = a.y + dy * t + tx * lateral;
					const radius =
						context.width *
						(0.035 + context.random("pencil-grain-radius", index) * 0.075);
					const rotation = context.random("pencil-grain-rotation", index) * Math.PI * 2;
					const sides = context.random("pencil-grain-sides", index) < 0.5 ? 5 : 6;
					const band = Math.floor(
						context.random("pencil-grain-band", index) * grainBands.length,
					);
					const commands = grainBands[band];
					// SVG 与 Canvas 的填充均隐式闭合子路径，无需额外的 Z。
					context.budget.addCommands(sides);
					for (let vertex = 0; vertex < sides; vertex++) {
						const theta = rotation + (Math.PI * 2 * vertex) / sides;
						const facetRadius =
							radius *
							(0.65 +
								context.random("pencil-grain-facet", index * 6 + vertex) * 0.35);
						const px = x + Math.cos(theta) * facetRadius;
						const py = y + Math.sin(theta) * facetRadius;
						if (!Number.isFinite(px) || !Number.isFinite(py))
							throw new RangeError("Pencil grain coordinate overflow");
						commands.push({ op: vertex === 0 ? "M" : "L", values: [px, py] });
					}
				}
			}
			for (let band = 0; band < grainBands.length; band++) {
				const commands = grainBands[band];
				if (!commands.length) continue;
				layers.push({
					geometry: geometryFromCommands(commands, "nonzero"),
					mode: "fill",
					role: context.strokeRole,
					opacity: [0.24, 0.44, 0.68][band],
					reveal: geometry,
					revealWidth,
				});
			}
			return layers;
		},
	};
}
