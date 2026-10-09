import { BatchBuilder } from "../core/ir.ts";
import type { InkBatch, Pen } from "../core/types.ts";
import { strokeRibbon } from "./ribbon.ts";

/** 变宽笔的参数；笔尖形状、压力映射与叠色方式均归笔所有。 */
export interface RibbonPenOptions {
	id: string;
	/** 压力为 1 时笔尖长轴的全宽，相对名义线宽的倍率。 */
	weight: number;
	/** 笔尖长轴角度，度；圆笔尖可忽略。 @default 0 */
	angle?: number;
	/** 笔尖短轴与长轴之比，(0, 1]。 @default 1 */
	aspect?: number;
	/** 压力映射到宽度倍率的下限与上限，及指数。 */
	minScale: number;
	maxScale: number;
	gamma?: number;
	/** 笔墨不透明度。 @default 1 */
	opacity?: number;
	/** 每条笔画独立成批：笔画重叠处叠色加深，同一笔自身重叠不加深。 @default false */
	layered?: boolean;
	/** 草稿复线相对主线的宽度倍率。 @default 0.75 */
	retraceWeight?: number;
	/** 草稿复线的不透明度，相对主线。 @default 0.7 */
	retraceOpacity?: number;
}

/**
 * 创建沿笔画求扫掠轮廓的变宽笔：每条笔画输出一个带圆帽的条带多边形。
 *
 * @remarks 条带保留左右点结构，动画可按前缀显现；返回的批次归生成器所有。
 *
 * @example
 * ```ts
 * const brush = createRibbonPen({ id: "brush", weight: 2, minScale: 0.1, maxScale: 1.4, gamma: 1.5 });
 * ```
 */
export function createRibbonPen(o: RibbonPenOptions): Pen {
	const angle = ((o.angle ?? 0) * Math.PI) / 180;
	const aspect = o.aspect ?? 1;
	const gamma = o.gamma ?? 1;
	const opacity = o.opacity ?? 1;
	const retraceWeight = o.retraceWeight ?? 0.75;
	const retraceOpacity = o.retraceOpacity ?? 0.7;
	return {
		id: o.id,
		ink(strokes, ctx, role) {
			const base = {
				width: ctx.width * o.weight,
				nib: { angle, aspect },
				minScale: o.minScale,
				maxScale: o.maxScale,
				gamma,
				precision: ctx.precision,
			};
			const batches: InkBatch[] = [];
			let main: BatchBuilder | undefined;
			let retrace: BatchBuilder | undefined;
			for (const stroke of strokes) {
				const retraced = stroke.pass > 0;
				const ribbon = strokeRibbon(
					stroke,
					retraced ? { ...base, width: base.width * retraceWeight } : base,
				);
				if (!ribbon) continue;
				const t0 = stroke.points[3];
				const t1 = stroke.points[stroke.points.length - 1];
				const style = { mode: "fill", role, fillRule: "nonzero" } as const;
				if (retraced) {
					retrace ??= new BatchBuilder({ ...style, opacity: opacity * retraceOpacity });
					retrace.ribbon(ribbon, t0, t1);
				} else if (o.layered) {
					batches.push(
						new BatchBuilder({ ...style, opacity }).ribbon(ribbon, t0, t1).build(),
					);
				} else {
					main ??= new BatchBuilder({ ...style, opacity });
					main.ribbon(ribbon, t0, t1);
				}
			}
			if (main) batches.push(main.build());
			if (retrace) batches.push(retrace.build());
			return batches;
		},
	};
}
