import type { Pen, PenOptions } from "../core/types.ts";
import { createRibbonPen } from "./ribbon-pen.ts";

/** 钢笔参数。 */
export interface InkPenOptions extends PenOptions {
	/** 压力为 1 时的线宽倍率。 @default 1.6 */
	weight?: number;
	/** 压感强度，[0, 1]：0 为恒宽，越大起收笔越细。 @default 0.92 */
	pressure?: number;
}

/**
 * 创建钢笔：圆笔尖，线宽随压力起伏，满压时比名义线宽略粗，起笔收笔自然收尖。
 *
 * @example
 * ```ts
 * const gentle = createInkPen({ pressure: 0.5 });
 * ```
 */
export function createInkPen(options: InkPenOptions = {}): Pen {
	return createRibbonPen({
		id: "inkpen",
		weight: options.weight ?? 1.6,
		minScale: 0,
		maxScale: 1.25,
		gamma: 1.5,
		pressure: options.pressure ?? 0.92,
	});
}

/** 马克笔参数。 */
export interface MarkerOptions extends PenOptions {
	/** 笔尖长轴的全宽，相对名义线宽的倍率。 @default 4 */
	weight?: number;
	/** 笔尖长轴角度，度。 @default -35 */
	angle?: number;
	/** 短轴与长轴之比。 @default 0.28 */
	aspect?: number;
	/** 笔墨不透明度；笔画重叠处叠色加深。 @default 0.78 */
	opacity?: number;
	/** 压感强度，[0, 1]：0 为恒宽，越大起收笔越细。 @default 0.15 */
	pressure?: number;
}

/**
 * 创建扁笔尖马克笔：半透明，不同笔画重叠处叠色加深，同一笔自身重叠不加深。
 *
 * @example
 * ```ts
 * const highlighter = createMarker({ weight: 7, opacity: 0.45 });
 * ```
 */
export function createMarker(options: MarkerOptions = {}): Pen {
	return createRibbonPen({
		id: "marker",
		weight: options.weight ?? 4,
		angle: options.angle ?? -35,
		aspect: options.aspect ?? 0.28,
		minScale: 0,
		maxScale: 1,
		pressure: options.pressure ?? 0.15,
		opacity: options.opacity ?? 0.78,
		layered: true,
	});
}

/** 默认钢笔。 */
export const inkpen = /* @__PURE__ */ createInkPen();

/** 默认马克笔。 */
export const marker = /* @__PURE__ */ createMarker();
