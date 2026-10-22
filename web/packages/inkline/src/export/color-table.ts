/** sRGB 三通道，0–255。 */
export type Rgb = readonly [number, number, number];

/** GIF 色表最多用 255 色，索引 255 留给差分帧里未变化的透明像素。 */
export const MAX_COLORS = 255;

// 与最近原色的距离超过它才算原色表达不了的像素（抗锯齿边、叠色、淡彩）。
const RESIDUAL_DISTANCE = 3;

/**
 * 构造全局色表：配色原色全部保留，剩余槽位用中位切分覆盖原色表达不准的像素。
 *
 * @param base - 配色原色，背景色放首位；重复色只保留一次
 * @param samples - 用于统计的 RGBA 帧，通常是末帧与中间帧
 */
export function buildColorTable(
	base: readonly Rgb[],
	samples: readonly Uint8ClampedArray[],
	size = MAX_COLORS,
): Rgb[] {
	const seen = new Set<number>();
	const table: Rgb[] = [];
	for (const color of base) {
		const key = pack(color[0], color[1], color[2]);
		if (seen.has(key) || table.length >= size) continue;
		seen.add(key);
		table.push(color);
	}
	if (table.length >= size) return table;
	const nearest = createNearest(table);
	const residual = new Map<number, number>();
	for (const rgba of samples)
		for (let i = 0; i < rgba.length; i += 4) {
			const [r, g, b] = [rgba[i], rgba[i + 1], rgba[i + 2]];
			const key = pack(r, g, b);
			const count = residual.get(key);
			if (count !== undefined) residual.set(key, count + 1);
			else if (distance(table[nearest(r, g, b)], r, g, b) > RESIDUAL_DISTANCE)
				residual.set(key, 1);
		}
	return [...table, ...medianCut(residual, size - table.length)];
}

/**
 * 把 RGBA 帧映射为色表索引，相同颜色只查一次。
 *
 * @remarks 传入 previous 时跳过与上一帧相同的像素，此时 out 须保留上一帧的索引。
 */
export function createColorMapper(table: readonly Rgb[]) {
	const nearest = createNearest(table);
	const cache = new Map<number, number>();
	return (rgba: Uint8ClampedArray, out: Uint8Array, previous?: Uint8ClampedArray): void => {
		const words = new Uint32Array(rgba.buffer, rgba.byteOffset, out.length);
		const before =
			previous && new Uint32Array(previous.buffer, previous.byteOffset, out.length);
		for (let p = 0; p < out.length; p++) {
			const word = words[p];
			if (before && before[p] === word) continue;
			let index = cache.get(word);
			if (index === undefined) {
				index = nearest(rgba[p * 4], rgba[p * 4 + 1], rgba[p * 4 + 2]);
				cache.set(word, index);
			}
			out[p] = index;
		}
	};
}

function pack(r: number, g: number, b: number): number {
	return (r << 16) | (g << 8) | b;
}

function distance(c: Rgb, r: number, g: number, b: number): number {
	return Math.hypot(c[0] - r, c[1] - g, c[2] - b);
}

/** 按人眼对绿色更敏感的权重找最近色。 */
function createNearest(table: readonly Rgb[]) {
	return (r: number, g: number, b: number): number => {
		let best = Number.POSITIVE_INFINITY;
		let index = 0;
		for (let j = 0; j < table.length; j++) {
			const dr = r - table[j][0];
			const dg = g - table[j][1];
			const db = b - table[j][2];
			const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
			if (d < best) {
				best = d;
				index = j;
			}
		}
		return index;
	};
}

type Bucket = [r: number, g: number, b: number, count: number][];

/** 中位切分：反复把「跨度 × 像素量」最大的盒子按中位数一分为二，每盒取加权平均色。 */
function medianCut(counts: Map<number, number>, size: number): Rgb[] {
	if (size <= 0 || counts.size === 0) return [];
	let boxes: Bucket[] = [
		[...counts].map(([key, count]) => [(key >> 16) & 255, (key >> 8) & 255, key & 255, count]),
	];
	while (boxes.length < size) {
		let best = -1;
		let bestScore = 0;
		let channel = 0;
		boxes.forEach((box, i) => {
			if (box.length < 2) return;
			const weight = Math.sqrt(box.reduce((n, c) => n + c[3], 0));
			for (let ch = 0; ch < 3; ch++) {
				let lo = 255;
				let hi = 0;
				for (const c of box) {
					if (c[ch] < lo) lo = c[ch];
					if (c[ch] > hi) hi = c[ch];
				}
				if ((hi - lo) * weight > bestScore) {
					bestScore = (hi - lo) * weight;
					best = i;
					channel = ch;
				}
			}
		});
		if (best < 0) break;
		const box = boxes[best].sort((p, q) => p[channel] - q[channel]);
		const total = box.reduce((n, c) => n + c[3], 0);
		let acc = 0;
		let cut = 1;
		for (; cut < box.length - 1; cut++) {
			acc += box[cut - 1][3];
			if (acc >= total / 2) break;
		}
		boxes = [
			...boxes.slice(0, best),
			box.slice(0, cut),
			box.slice(cut),
			...boxes.slice(best + 1),
		];
	}
	return boxes.map((box) => {
		const total = box.reduce((n, c) => n + c[3], 0);
		const mean = (ch: number) => Math.round(box.reduce((n, c) => n + c[ch] * c[3], 0) / total);
		return [mean(0), mean(1), mean(2)];
	});
}
