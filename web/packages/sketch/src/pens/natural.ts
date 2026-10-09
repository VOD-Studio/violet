import { geometryFromCommands } from "../geometry.ts";
import type { Command, Geometry, InkLayer, Pen, PenContext } from "../types.ts";

/** 连续曲线笔迹的造型配置；不控制几何采样容差。 */
export interface NaturalOptions {
	/** 绘制遍数，应为正整数；首遍为主线，后续遍为较细的半透明复线。 */
	passes?: number;
	/** 非负造型幅度；控制线段弯曲、控制柄倍率与附加复线偏移，不是统一距离上界。 */
	deviation?: number;
}

/**
 * 创建保留主线端点的曲线笔迹，不预先将全部路径离散为折线。
 *
 * @returns 使用 Palette 描边角色的算法；附加遍独立偏移，不修改原始语义骨架。
 * @remarks 二次曲线与圆弧在主线中原样保留；deviation 不代表每种命令都施加相同扰动。
 */
export function createNaturalPen(options: NaturalOptions = {}): Pen {
	const passes = options.passes ?? 1;
	const deviation = options.deviation ?? 1.1;
	return {
		id: `curve-ink:${passes}:${deviation}`,
		generate(geometry: Geometry, context: PenContext) {
			const layers: InkLayer[] = [];
			for (let pass = 0; pass < passes; pass++) {
				const dx = pass ? (context.random("retrace-x", pass) - 0.5) * deviation : 0;
				const dy = pass ? (context.random("retrace-y", pass) - 0.5) * deviation : 0;
				const commands: Command[] = [];
				let x = 0,
					y = 0,
					sx = 0,
					sy = 0;
				for (let i = 0; i < geometry.commands.length; i++) {
					const command = geometry.commands[i],
						v = command.values;
					if (command.op === "M") {
						x = v[0];
						y = v[1];
						sx = x;
						sy = y;
						commands.push({ op: "M", values: [x + dx, y + dy] });
					} else if (command.op === "L") {
						const ex = v[0],
							ey = v[1],
							vx = ex - x,
							vy = ey - y,
							length = Math.hypot(vx, vy);
						const amount =
							(context.random(`bow:${pass}`, i) - 0.5) *
							deviation *
							Math.min(1, length / 60);
						const nx = length ? (-vy * amount) / length : 0,
							ny = length ? (vx * amount) / length : 0;
						commands.push(
							{
								op: "C",
								values: [
									x + vx / 6 + dx,
									y + vy / 6 + dy,
									x + vx / 3 + nx + dx,
									y + vy / 3 + ny + dy,
									x + vx / 2 + nx + dx,
									y + vy / 2 + ny + dy,
								],
							},
							{
								op: "C",
								values: [
									x + (vx * 2) / 3 + nx + dx,
									y + (vy * 2) / 3 + ny + dy,
									x + (vx * 5) / 6 + dx,
									y + (vy * 5) / 6 + dy,
									ex + dx,
									ey + dy,
								],
							},
						);
						x = ex;
						y = ey;
					} else if (command.op === "C") {
						const a =
							1 + ((context.random(`control-a:${pass}`, i) - 0.5) * deviation) / 8;
						const b =
							1 + ((context.random(`control-b:${pass}`, i) - 0.5) * deviation) / 8;
						commands.push({
							op: "C",
							values: [
								x + (v[0] - x) * a + dx,
								y + (v[1] - y) * a + dy,
								v[4] + (v[2] - v[4]) * b + dx,
								v[5] + (v[3] - v[5]) * b + dy,
								v[4] + dx,
								v[5] + dy,
							],
						});
						x = v[4];
						y = v[5];
					} else if (command.op === "Q") {
						commands.push({
							op: "Q",
							values: [v[0] + dx, v[1] + dy, v[2] + dx, v[3] + dy],
						});
						x = v[2];
						y = v[3];
					} else if (command.op === "A") {
						commands.push({
							op: "A",
							values: [v[0], v[1], v[2], v[3], v[4], v[5] + dx, v[6] + dy],
						});
						x = v[5];
						y = v[6];
					} else {
						commands.push({ op: "Z", values: [] });
						x = sx;
						y = sy;
					}
				}
				context.budget.addCommands(commands.length);
				layers.push({
					geometry: geometryFromCommands(commands, geometry.fillRule),
					mode: "stroke",
					role: context.strokeRole,
					width: context.width * (pass ? 0.55 : 1),
					opacity: pass ? 0.48 : 1,
					reveal: geometry,
					revealWidth: context.width + deviation * 4 + 4,
				});
			}
			return layers;
		},
	};
}
