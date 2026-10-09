import { geometryFromCommands } from "../geometry.ts";
import type { Command, InkLayer, Pen } from "../types.ts";
import { createPressurePen, type PressureOptions } from "./pressure.ts";

/** 彩漫笔迹的笔尖参数和明暗角色；实际颜色由消费方 palette 提供。 */
export interface ComicOptions {
	/** 轮廓压感参数；未覆盖时角度为 -30 度、轴比为 0.72，其余使用压感笔默认值。 */
	pressure?: PressureOptions;
	/** 阴影的 palette 角色键，缺省为 shadow，不是直接颜色值。 */
	shadowRole?: string;
	/** 高光的 palette 角色键，缺省为 highlight，不是直接颜色值。 */
	highlightRole?: string;
	/** 阴影不透明度，应在 [0, 1] 内，缺省为 0.15；零值仍生成图层，本工厂不校验或钳制。 */
	shadowOpacity?: number;
	/** 高光不透明度，应在 [0, 1] 内，缺省为 0.27；零值仍生成图层，本工厂不校验或钳制。 */
	highlightOpacity?: number;
}

/**
 * 先叠加裁剪到原区域的矢量明暗，再用压感笔生成轮廓。
 *
 * @returns 分别生成明暗与轮廓角色图层的笔，不负责基础底色填充
 * @remarks 仅在存在 fillRole、geometry.closed 为真且包围盒宽高均大于五倍线宽时添加明暗。
 * 明暗位置依赖保守包围盒，closed 只检查任意 Z，不保证全部子路径闭合。
 * @throws {@link RangeError} 当压感笔配置或生成违反 createPressurePen 的约束。
 * @throws 当共享预算耗尽时，传播 budget 抛出的错误。
 */
export function createComicPen(options: ComicOptions = {}): Pen {
	const outline = createPressurePen({ angle: -30, aspect: 0.72, ...options.pressure });
	return {
		id: "comic",
		generate(geometry, context) {
			const layers: InkLayer[] = [];
			const { x, y, width: w, height: h } = geometry.bounds;
			if (
				context.fillRole &&
				geometry.closed &&
				w > context.width * 5 &&
				h > context.width * 5
			) {
				const point = (u: number, v: number) => [x + w * u, y + h * v];
				const add = (commands: readonly Command[], role: string, opacity: number) => {
					context.budget.addCommands(commands.length);
					layers.push({
						geometry: geometryFromCommands(commands),
						mode: "fill",
						role,
						opacity,
						clip: geometry,
					});
				};
				add(
					[
						{ op: "M", values: point(0.76, 0.12) },
						{
							op: "C",
							values: [
								...point(0.71, 0.48),
								...point(0.62, 0.69),
								...point(0.18, 0.86),
							],
						},
						{ op: "L", values: point(-0.05, 1.05) },
						{ op: "L", values: point(1.05, 1.05) },
						{ op: "L", values: point(1.05, -0.05) },
						{ op: "Z", values: [] },
					],
					options.shadowRole ?? "shadow",
					options.shadowOpacity ?? 0.15,
				);
				add(
					[
						{ op: "M", values: point(0.08, 0.21) },
						{
							op: "C",
							values: [
								...point(0.2, 0.04),
								...point(0.47, 0.01),
								...point(0.63, 0.08),
							],
						},
						{
							op: "C",
							values: [
								...point(0.4, 0.08),
								...point(0.22, 0.16),
								...point(0.15, 0.35),
							],
						},
						{ op: "Z", values: [] },
					],
					options.highlightRole ?? "highlight",
					options.highlightOpacity ?? 0.27,
				);
			}
			layers.push(...outline.generate(geometry, context));
			return layers;
		},
	};
}
