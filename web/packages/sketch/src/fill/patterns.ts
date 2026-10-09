import { polylineContour } from "../core/flatten.ts";
import { channel } from "../core/rng.ts";
import type { Contour, DrawContext, Fill, Skeleton } from "../core/types.ts";
import { scanSpans } from "./scan.ts";

const ROW = channel("sketch:fill:row");
const TILT = channel("sketch:fill:tilt");
const DOT = channel("sketch:fill:dot");

/** 图案填充参数。 */
export interface PatternOptions {
	/** 排线间距，场景单位；缺省为 max(8 × 填充线宽, 5)，即名义线宽的 4 倍。 */
	gap?: number;
	/** 排线角度，度。 @default -41 */
	angle?: number;
}

type Pattern = "hachure" | "cross-hatch" | "dashed" | "zigzag" | "zigzag-line" | "dots";

const TILT_RANGE = (1.5 * Math.PI) / 180;

function patternFill(id: Pattern, options: PatternOptions = {}): Fill {
	return {
		id,
		generate(region, ctx) {
			const gap = options.gap ?? Math.max(8 * ctx.width, 5);
			const base = ((options.angle ?? -41) * Math.PI) / 180;
			const contours: Contour[] = [];
			const angles = id === "cross-hatch" ? [base, base + Math.PI / 2] : [base];
			angles.forEach((angle, pass) => {
				const c = Math.cos(angle);
				const s = Math.sin(angle);
				const rowGap = id === "zigzag-line" ? gap * 1.5 : gap;
				let mark = pass * 1_000_000;
				// 旋转坐标系 → 场景坐标系。
				const emit = (xy: number[], closed = false) => {
					for (let i = 0; i < xy.length; i += 2) {
						const ax = xy[i];
						const ay = xy[i + 1];
						xy[i] = c * ax - s * ay;
						xy[i + 1] = s * ax + c * ay;
					}
					contours.push(polylineContour(xy, closed));
				};
				const tilted = (left: number, right: number, y: number) => {
					const dy =
						Math.tan((ctx.random(TILT, mark++) * 2 - 1) * TILT_RANGE) *
						(right - left) *
						0.5;
					return [left, y - dy, right, y + dy];
				};
				const rowY = (row: number) =>
					(row + (ctx.random(ROW, row + pass * 7919) - 0.5) * 0.2) * rowGap;

				let chains: number[][] = [];
				let previousRow = Number.NaN;
				let spanIndex = 0;
				const flushChains = () => {
					for (const chain of chains) if (chain.length >= 4) emit(chain);
					chains = [];
				};

				scanSpans(region, angle, rowGap, rowY, (left, right, y, row) => {
					if (id === "hachure" || id === "cross-hatch") emit(tilted(left, right, y));
					else if (id === "dashed") {
						const period = gap * 1.7;
						const dash = gap * 0.9;
						const offset = row % 2 ? period / 2 : 0;
						for (
							let x = Math.floor((left - offset) / period) * period + offset;
							x < right;
							x += period
						) {
							const a = Math.max(left, x);
							const b = Math.min(right, x + dash);
							if (b - a > gap * 0.15) emit(tilted(a, b, y));
						}
					} else if (id === "zigzag-line") {
						const step = gap * 0.5;
						const amplitude = gap * 0.35;
						const xy: number[] = [left, y];
						let tooth = 0;
						for (let x = left + step; x < right; x += step)
							xy.push(x, y + (tooth++ % 2 ? -amplitude : amplitude));
						xy.push(right, y);
						emit(xy);
					} else if (id === "zigzag") {
						// 同一区间序号的相邻行连成一笔斜向往返折线；区间数变化时断开。
						if (row !== previousRow) {
							if (row !== previousRow + 1) flushChains();
							previousRow = row;
							spanIndex = 0;
						}
						const chain = chains[spanIndex] ?? [];
						chains[spanIndex++] = chain;
						chain.push(left, y, right, y + rowGap / 2);
					} else {
						const offset = row % 2 ? gap / 2 : 0;
						const r = Math.max(ctx.width, gap * 0.15);
						for (
							let x = Math.ceil((left - offset) / gap) * gap + offset;
							x <= right;
							x += gap
						) {
							const index = mark++;
							const px = x + (ctx.random(DOT, index * 2) - 0.5) * gap * 0.15;
							const py = y + (ctx.random(DOT, index * 2 + 1) - 0.5) * gap * 0.15;
							const xy: number[] = [];
							for (let k = 0; k < 10; k++) {
								const a = (Math.PI * 2 * k) / 10;
								xy.push(px + r * Math.cos(a), py + r * Math.sin(a));
							}
							emit(xy, true);
						}
					}
				});
				flushChains();
			});
			const guides: Skeleton = { contours, fillRule: "nonzero" };
			return { guides };
		},
	};
}

/** 实色填充：按原路径与填充规则直接上色，不经过笔。 */
export const solidFill: Fill = {
	id: "solid",
	generate(_region, _ctx: DrawContext, source) {
		return { areas: [source] };
	},
};

/**
 * 创建排线类图案填充。
 *
 * @example
 * ```ts
 * const dense = createPatternFill("cross-hatch", { gap: 6, angle: 30 });
 * ```
 */
export function createPatternFill(id: Pattern, options?: PatternOptions): Fill {
	return patternFill(id, options);
}

/** 内置填充；名称与 Rough.js 的 fillStyle 一致。 */
export const fills = {
	solid: solidFill,
	hachure: patternFill("hachure"),
	"cross-hatch": patternFill("cross-hatch"),
	dashed: patternFill("dashed"),
	zigzag: patternFill("zigzag"),
	"zigzag-line": patternFill("zigzag-line"),
	dots: patternFill("dots"),
} as const;
