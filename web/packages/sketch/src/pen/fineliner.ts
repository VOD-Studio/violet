import { BatchBuilder } from "../core/ir.ts";
import type { InkBatch, Pen } from "../core/types.ts";
import { createRibbonPen } from "./ribbon-pen.ts";

/** 签字笔参数。 */
export interface FinelinerOptions {
	/** 相对名义线宽的倍率。 @default 1 */
	weight?: number;
	/** 压力对线宽的影响，[0, 1)：0 为恒宽，走原生描边快速路径；大于 0 时线宽在 `1 − pressure` 到 1 之间随压力变化。 @default 0 */
	pressure?: number;
	/** 草稿复线相对主线的线宽倍率。 @default 0.75 */
	retraceWeight?: number;
	/** 草稿复线的不透明度。 @default 0.7 */
	retraceOpacity?: number;
}

/**
 * 创建圆笔尖签字笔；pressure 为 0 时以原生恒宽描边输出，不生成轮廓。
 *
 * @returns 主笔与复线各一个批次的笔
 */
export function createFineliner(options: FinelinerOptions = {}): Pen {
	const pressure = options.pressure ?? 0;
	if (pressure > 0)
		return createRibbonPen({
			id: "fineliner",
			weight: options.weight ?? 1,
			minScale: 1 - pressure,
			maxScale: 1,
			retraceWeight: options.retraceWeight ?? 0.75,
			retraceOpacity: options.retraceOpacity ?? 0.7,
		});
	return constantFineliner(
		options.weight ?? 1,
		options.retraceWeight ?? 0.75,
		options.retraceOpacity ?? 0.7,
	);
}

/** 恒宽签字笔，单独成函数以便默认笔不依赖条带实现。 */
function constantFineliner(weight: number, retraceWeight: number, retraceOpacity: number): Pen {
	return {
		id: "fineliner",
		ink(strokes, ctx, role) {
			const width = ctx.width * weight;
			const main = new BatchBuilder({ mode: "stroke", role, width });
			let retrace: BatchBuilder | undefined;
			for (const stroke of strokes) {
				if (!stroke.pass) main.stroke(stroke);
				else {
					retrace ??= new BatchBuilder({
						mode: "stroke",
						role,
						width: width * retraceWeight,
						opacity: retraceOpacity,
					});
					retrace.stroke(stroke);
				}
			}
			const batches: InkBatch[] = [];
			if (!main.empty) batches.push(main.build());
			if (retrace) batches.push(retrace.build());
			return batches;
		},
	};
}

/** 默认签字笔：恒宽、走原生描边快速路径。 */
export const fineliner = /* @__PURE__ */ constantFineliner(1, 0.75, 0.7);
