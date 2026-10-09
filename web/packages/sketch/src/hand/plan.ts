import { channel } from "../core/rng.ts";
import type { Contour, DrawContext, Skeleton } from "../core/types.ts";

const PHASE = channel("sketch:plan:phase");
const OVERLAP = channel("sketch:plan:overlap");
const BREAK = channel("sketch:plan:break");
const BREAK_PICK = channel("sketch:plan:break-pick");
const OVERSHOOT = channel("sketch:plan:overshoot");

/** 笔画规划参数。 */
export interface PlanOptions {
	/** 每个角点断笔的概率，[0, 1]。 */
	breakChance: number;
	/** 断笔处越界长度的倍率；0 表示不越界。 */
	overshoot: number;
	/** 闭合曲线末端越过起点的比例区间 [min, max]，相对周长。 */
	overlap: readonly [number, number];
	/** 一笔的最长长度，CSS 像素；超过时拆成多笔。 */
	maxStroke: number;
	/** 复画遍数，1 为单遍。 */
	passes: number;
}

/** 沿某条轮廓的一笔：[start, end] 为轮廓弧长，闭合轮廓的 end 可超过周长。 */
export interface StrokePlan {
	readonly contour: Contour;
	/** 轮廓序号，用于派生随机通道。 */
	readonly contourIndex: number;
	readonly start: number;
	readonly end: number;
	/** 沿起点切线反向延伸的越界长度。 */
	readonly extendStart: number;
	/** 沿终点切线延伸的越界长度。 */
	readonly extendEnd: number;
	readonly pinStart: boolean;
	readonly pinEnd: boolean;
	/** 图元内稳定的笔画键，与复画遍数无关。 */
	readonly key: number;
	readonly pass: number;
}

interface Range {
	start: number;
	end: number;
	extendStart: number;
	extendEnd: number;
	pinStart: boolean;
	pinEnd: boolean;
}

/**
 * 把骨架拆成笔画：大转角按概率断笔并交叉越界，闭合曲线首尾错开重叠，超长路径分笔。
 *
 * @returns 按落笔顺序排列；复画紧跟在各自主笔之后
 */
export function planStrokes(
	skeleton: Skeleton,
	ctx: DrawContext,
	options: PlanOptions,
): StrokePlan[] {
	const plans: StrokePlan[] = [];
	const w = ctx.width;
	const maxStroke = options.maxStroke / ctx.pixelScale;
	// 越界只有线宽量级：再长就成了刻意的十字线头。
	const overshoot = (key: number) =>
		Math.min(2 * w, w * ctx.random(OVERSHOOT, key) * options.overshoot);

	skeleton.contours.forEach((contour, ci) => {
		const L = contour.length;
		if (L <= 1e-9) return;
		const base = ci * 4096;
		const cornerAt = Array.from(contour.corners, (i) => contour.arc[i]);
		const ranges: Range[] = [];

		if (contour.closed && !cornerAt.length) {
			const phase = ctx.random(PHASE, base) * L;
			const [lo, hi] = options.overlap;
			const overlap = L * (lo + (hi - lo) * ctx.random(OVERLAP, base));
			ranges.push({
				start: phase,
				end: phase + L + overlap,
				extendStart: 0,
				extendEnd: 0,
				pinStart: false,
				pinEnd: false,
			});
		} else if (contour.closed) {
			let breaks = cornerAt.filter(
				(_, i) => ctx.random(BREAK, base + i) < options.breakChance,
			);
			if (!breaks.length)
				breaks = [cornerAt[Math.floor(ctx.random(BREAK_PICK, base) * cornerAt.length)]];
			for (let i = 0; i < breaks.length; i++) {
				const start = breaks[i];
				let end = breaks[(i + 1) % breaks.length];
				if (end <= start) end += L;
				ranges.push({
					start,
					end,
					extendStart: overshoot(base + i * 2),
					extendEnd: overshoot(base + i * 2 + 1),
					pinStart: false,
					pinEnd: false,
				});
			}
		} else {
			const cuts = [
				0,
				...cornerAt.filter((_, i) => ctx.random(BREAK, base + i) < options.breakChance),
				L,
			];
			for (let i = 0; i < cuts.length - 1; i++) {
				const first = i === 0;
				const last = i === cuts.length - 2;
				ranges.push({
					start: cuts[i],
					end: cuts[i + 1],
					extendStart: first ? 0 : overshoot(base + i * 2),
					extendEnd: last ? 0 : overshoot(base + i * 2 + 1),
					pinStart: first && ctx.pinEnds,
					pinEnd: last && ctx.pinEnds,
				});
			}
		}

		let key = base;
		for (const range of ranges) {
			const length = range.end - range.start;
			const pieces = Math.max(1, Math.ceil(length / maxStroke));
			// 分笔接缝两侧各重叠半个线宽，避免出现缝隙。
			const seam = w * 0.5;
			for (let p = 0; p < pieces; p++) {
				const first = p === 0;
				const last = p === pieces - 1;
				const piece = {
					contour,
					contourIndex: ci,
					start: range.start + (length * p) / pieces - (first ? 0 : seam),
					end: range.start + (length * (p + 1)) / pieces + (last ? 0 : seam),
					extendStart: first ? range.extendStart : 0,
					extendEnd: last ? range.extendEnd : 0,
					pinStart: first && range.pinStart,
					pinEnd: last && range.pinEnd,
					key: key++,
				};
				for (let pass = 0; pass < options.passes; pass++) plans.push({ ...piece, pass });
			}
		}
	});
	return plans;
}
