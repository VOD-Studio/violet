import { CLOSE, CUBIC, type InkBatch, LINE, MOVE } from "../core/types.ts";

/** 批次中一个子路径的显现轨迹，SVG 与 Canvas 共用。 */
export interface Track {
	/** stroke：沿路径显现；ribbon：条带按前缀显现；area：整块淡入。 */
	readonly kind: "stroke" | "ribbon" | "area";
	/** 动词与坐标在批次数组中的区间 [v0, v1) 与 [c0, c1)。 */
	readonly v0: number;
	readonly v1: number;
	readonly c0: number;
	readonly c1: number;
	/** 图元归一化的落笔时间。 */
	readonly t0: number;
	readonly t1: number;
	/** 近似路径长度；仅 stroke 轨迹使用，用于 Canvas 的虚线显现。 */
	readonly length: number;
	/** 条带的左侧点数与帽点数；仅 ribbon 轨迹使用。 */
	readonly n: number;
	readonly c: number;
}

const cache = new WeakMap<InkBatch, readonly Track[]>();

/** 估算三次曲线长度：弦长与控制多边形长度的加权平均，误差在百分之几以内。 */
function cubicLength(x0: number, y0: number, c: ArrayLike<number>, o: number): number {
	const chord = Math.hypot(c[o + 4] - x0, c[o + 5] - y0);
	const poly =
		Math.hypot(c[o] - x0, c[o + 1] - y0) +
		Math.hypot(c[o + 2] - c[o], c[o + 3] - c[o + 1]) +
		Math.hypot(c[o + 4] - c[o + 2], c[o + 5] - c[o + 3]);
	return (2 * chord + poly) / 3;
}

/**
 * 把批次拆成按子路径的显现轨迹；结果按批次对象缓存。
 *
 * @remarks 批次按不可变值使用，生成后修改其数组会使缓存失效。
 */
export function batchTracks(batch: InkBatch): readonly Track[] {
	const hit = cache.get(batch);
	if (hit) return hit;
	const tracks: Track[] = [];
	const { verbs, coords, spans, ribbons } = batch;
	// 区域填充的子路径共同构成一个形状（如 evenodd 合成的月牙），必须整体显现，不能按子路径拆开。
	if (batch.mode === "fill" && !ribbons) {
		const whole: readonly Track[] = [
			{
				kind: "area",
				v0: 0,
				v1: verbs.length,
				c0: 0,
				c1: coords.length,
				t0: spans[0] ?? 0,
				t1: spans[1] ?? 1,
				length: 0,
				n: 0,
				c: 0,
			},
		];
		cache.set(batch, whole);
		return whole;
	}
	let sub = -1;
	let v0 = 0;
	let c0 = 0;
	let c = 0;
	let x = 0;
	let y = 0;
	let length = 0;
	const flush = (v1: number) => {
		if (sub < 0) return;
		const n = ribbons?.[sub * 2] ?? 0;
		tracks.push({
			kind: n > 0 ? "ribbon" : batch.mode === "stroke" ? "stroke" : "area",
			v0,
			v1,
			c0,
			c1: c,
			t0: spans[sub * 2],
			t1: spans[sub * 2 + 1],
			length,
			n,
			c: ribbons?.[sub * 2 + 1] ?? 0,
		});
	};
	for (let v = 0; v < verbs.length; v++) {
		const verb = verbs[v];
		if (verb === MOVE) {
			flush(v);
			sub++;
			v0 = v;
			c0 = c;
			length = 0;
			x = coords[c++];
			y = coords[c++];
		} else if (verb === LINE) {
			length += Math.hypot(coords[c] - x, coords[c + 1] - y);
			x = coords[c++];
			y = coords[c++];
		} else if (verb === CUBIC) {
			length += cubicLength(x, y, coords, c);
			x = coords[c + 4];
			y = coords[c + 5];
			c += 6;
		} else if (verb === CLOSE) continue;
	}
	flush(verbs.length);
	cache.set(batch, tracks);
	return tracks;
}

/** 轨迹在时间 u（图元归一化）的显现比例，[0, 1]。 */
export function trackProgress(track: Track, u: number): number {
	if (u <= track.t0) return 0;
	if (u >= track.t1 || track.t1 <= track.t0) return 1;
	return (u - track.t0) / (track.t1 - track.t0);
}

/** 淡入曲线：端点平滑，避免区域突然出现。 */
export function ease(p: number): number {
	return p * p * (3 - 2 * p);
}

/**
 * 取条带前缀多边形的点序（交错 x、y）：左侧前 k 点，接右侧前 k 点（自 k−1 回到 0），不含圆帽。
 *
 * @param p - 显现比例，(0, 1)
 */
export function ribbonPrefix(coords: ArrayLike<number>, track: Track, p: number): number[] {
	const { c0, n, c } = track;
	const k = Math.max(2, Math.min(n, Math.ceil(p * n)));
	const out: number[] = [];
	for (let i = 0; i < k; i++) out.push(coords[c0 + i * 2], coords[c0 + i * 2 + 1]);
	// 右侧点自末向首存放：第 n + c + j 点对应右侧第 n−1−j 点。
	for (let j = n - k; j < n; j++) {
		const index = n + c + j;
		out.push(coords[c0 + index * 2], coords[c0 + index * 2 + 1]);
	}
	return out;
}
