import { BatchBuilder } from "../core/ir.ts";
import type { InkBatch, Pen } from "../core/types.ts";

/** 签字笔参数。 */
export interface FinelinerOptions {
	/** 相对名义线宽的倍率。 @default 1 */
	weight?: number;
	/** 草稿复线相对主线的线宽倍率。 @default 0.75 */
	retraceWeight?: number;
	/** 草稿复线的不透明度。 @default 0.7 */
	retraceOpacity?: number;
}

/**
 * 创建圆笔尖签字笔；恒压时以原生恒宽描边输出，不生成轮廓。
 *
 * @returns 主笔与复线各一个批次的笔
 */
export function createFineliner(options: FinelinerOptions = {}): Pen {
	const weight = options.weight ?? 1;
	const retraceWeight = options.retraceWeight ?? 0.75;
	const retraceOpacity = options.retraceOpacity ?? 0.7;
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

/** 内置笔预设。 */
export const pens = {
	fineliner: createFineliner(),
} as const;
