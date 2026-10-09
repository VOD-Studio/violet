import { CLOSE, type Contour, CUBIC, LINE, MOVE, type Path, type Skeleton } from "./types.ts";

/** 相邻切线夹角超过该值的接合点视为角点。 */
export const CORNER_ANGLE = (55 * Math.PI) / 180;
const CORNER_COS = Math.cos(CORNER_ANGLE);
const MAX_POINTS = 1_000_000;
const CACHE_LIMIT = 4;

const cache = new WeakMap<Path, Map<number, Skeleton>>();

// Levien「Flattening quadratic Béziers」中抛物线弧长积分的近似式及其反函数。
function approxIntegral(x: number): number {
	const d = 0.67;
	return x / (1 - d + (d ** 4 + 0.25 * x * x) ** 0.25);
}

function approxInverse(x: number): number {
	const b = 0.39;
	return x * (1 - b + Math.sqrt(b * b + 0.25 * x * x));
}

class ContourWriter {
	points: number[] = [];
	joins: number[] = [];

	push(x: number, y: number): void {
		const n = this.points.length;
		if (n && Math.abs(this.points[n - 2] - x) < 1e-9 && Math.abs(this.points[n - 1] - y) < 1e-9)
			return;
		if (n >= MAX_POINTS * 2) throw new RangeError("展平点数超过 1000000；未放宽精度");
		this.points.push(x, y);
	}

	/** 标记当前末点为命令接合处，供角点检测使用。 */
	join(): void {
		this.joins.push(this.points.length / 2 - 1);
	}

	quad(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, tol: number) {
		const ddx = 2 * x1 - x0 - x2;
		const ddy = 2 * y1 - y0 - y2;
		const cross = (x2 - x0) * ddy - (y2 - y0) * ddx;
		const lenDd = Math.hypot(ddx, ddy);
		if (Math.abs(cross) < 1e-12 || lenDd < 1e-12) {
			this.push(x2, y2);
			return;
		}
		const u0 = ((x1 - x0) * ddx + (y1 - y0) * ddy) / cross;
		const u2 = ((x2 - x1) * ddx + (y2 - y1) * ddy) / cross;
		const scale = Math.abs(cross) / (lenDd * Math.abs(u2 - u0));
		const a0 = approxIntegral(u0);
		const a2 = approxIntegral(u2);
		const count = 0.5 * Math.abs(a2 - a0) * Math.sqrt(scale / tol);
		const n = Number.isFinite(count) ? Math.max(1, Math.ceil(count)) : 1;
		const v0 = approxInverse(a0);
		const v2 = approxInverse(a2);
		for (let i = 1; i < n; i++) {
			const t = (approxInverse(a0 + ((a2 - a0) * i) / n) - v0) / (v2 - v0);
			const mt = 1 - t;
			this.push(
				mt * mt * x0 + 2 * mt * t * x1 + t * t * x2,
				mt * mt * y0 + 2 * mt * t * y1 + t * t * y2,
			);
		}
		this.push(x2, y2);
	}

	cubic(p: ArrayLike<number>, o: number, x0: number, y0: number, tol: number): void {
		const x1 = p[o];
		const y1 = p[o + 1];
		const x2 = p[o + 2];
		const y2 = p[o + 3];
		const x3 = p[o + 4];
		const y3 = p[o + 5];
		// 三次→二次的误差上界 √3/36·|p3−3p2+3p1−p0|·(1/n)³，各分一半容差。
		const err =
			(Math.sqrt(3) / 36) * Math.hypot(x3 - 3 * x2 + 3 * x1 - x0, y3 - 3 * y2 + 3 * y1 - y0);
		const n = Math.max(1, Math.ceil(Math.cbrt(err / (tol * 0.5))));
		let sx = x0;
		let sy = y0;
		for (let i = 0; i < n; i++) {
			const ta = i / n;
			const tb = (i + 1) / n;
			const ex = cubicAt(x0, x1, x2, x3, tb);
			const ey = cubicAt(y0, y1, y2, y3, tb);
			// 子段两端导数推出的二次控制点：q = (3(c1 + c2) − (p0 + p3)) / 4。
			const h = (tb - ta) / 3;
			const c1x = sx + h * cubicDerivative(x0, x1, x2, x3, ta);
			const c1y = sy + h * cubicDerivative(y0, y1, y2, y3, ta);
			const c2x = ex - h * cubicDerivative(x0, x1, x2, x3, tb);
			const c2y = ey - h * cubicDerivative(y0, y1, y2, y3, tb);
			this.quad(
				sx,
				sy,
				(3 * (c1x + c2x) - sx - ex) / 4,
				(3 * (c1y + c2y) - sy - ey) / 4,
				ex,
				ey,
				tol * 0.5,
			);
			sx = ex;
			sy = ey;
		}
	}
}

function cubicAt(a: number, b: number, c: number, d: number, t: number): number {
	const mt = 1 - t;
	return mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d;
}

function cubicDerivative(a: number, b: number, c: number, d: number, t: number): number {
	const mt = 1 - t;
	return 3 * (mt * mt * (b - a) + 2 * mt * t * (c - b) + t * t * (d - c));
}

function finish(writer: ContourWriter, closed: boolean, out: Contour[]): void {
	const contour = buildContour(writer.points, writer.joins, closed);
	if (contour) out.push(contour);
}

/** @param joins - 参与角点检测的顶点下标；null 表示全部顶点。 */
function buildContour(
	raw: ArrayLike<number>,
	joins: readonly number[] | null,
	closed: boolean,
): Contour | null {
	let n = raw.length / 2;
	if (closed && n > 1 && raw[0] === raw[n * 2 - 2] && raw[1] === raw[n * 2 - 1]) n--;
	if (n < 1) return null;
	const points = new Float64Array(n * 2);
	for (let i = 0; i < n * 2; i++) points[i] = raw[i];
	const arc = new Float64Array(n);
	for (let i = 1; i < n; i++)
		arc[i] =
			arc[i - 1] +
			Math.hypot(points[i * 2] - points[i * 2 - 2], points[i * 2 + 1] - points[i * 2 - 1]);
	const length =
		arc[n - 1] +
		(closed && n > 1
			? Math.hypot(points[0] - points[n * 2 - 2], points[1] - points[n * 2 - 1])
			: 0);
	const candidates: number[] = [];
	if (joins) {
		for (const j of joins) candidates.push(j >= n ? 0 : j);
		if (closed) candidates.push(0);
		candidates.sort((a, b) => a - b);
	} else for (let i = 0; i < n; i++) candidates.push(i);
	const corners: number[] = [];
	for (let k = 0; k < candidates.length; k++) {
		const i = candidates[k];
		if (k && candidates[k - 1] === i) continue;
		if (!closed && (i <= 0 || i >= n - 1)) continue;
		const prev = (i - 1 + n) % n;
		const next = (i + 1) % n;
		const ax = points[i * 2] - points[prev * 2];
		const ay = points[i * 2 + 1] - points[prev * 2 + 1];
		const bx = points[next * 2] - points[i * 2];
		const by = points[next * 2 + 1] - points[i * 2 + 1];
		const la = Math.hypot(ax, ay);
		const lb = Math.hypot(bx, by);
		if (la && lb && (ax * bx + ay * by) / (la * lb) < CORNER_COS) corners.push(i);
	}
	return { points, arc, corners: Uint32Array.from(corners), closed, length };
}

/**
 * 由折线顶点构造轮廓，每个顶点都参与角点检测；用于填充图案等程序生成的骨架。
 *
 * @param xy - 交错存放的顶点坐标，至少一个点
 */
export function polylineContour(xy: ArrayLike<number>, closed = false): Contour {
	const contour = buildContour(xy, null, closed);
	if (!contour) throw new RangeError("轮廓至少需要一个点");
	return contour;
}

/**
 * 把路径展平为带弧长与角点的骨架。
 *
 * @param precision - 折线与原曲线的最大偏差，场景单位
 * @returns 只读骨架；按路径对象身份缓存，每条路径最多保留四种精度
 * @throws {@link RangeError} 当单条路径展平超过 1000000 点。
 */
export function flatten(path: Path, precision: number): Skeleton {
	let entries = cache.get(path);
	const hit = entries?.get(precision);
	if (hit) return hit;
	const contours: Contour[] = [];
	let writer = new ContourWriter();
	let x = 0;
	let y = 0;
	let sx = 0;
	let sy = 0;
	let open = false;
	let c = 0;
	const { verbs, coords } = path;
	for (let v = 0; v < verbs.length; v++) {
		const verb = verbs[v];
		if (verb === MOVE) {
			if (open) finish(writer, false, contours);
			writer = new ContourWriter();
			x = sx = coords[c++];
			y = sy = coords[c++];
			writer.push(x, y);
			open = true;
		} else if (verb === LINE) {
			x = coords[c++];
			y = coords[c++];
			writer.push(x, y);
			writer.join();
		} else if (verb === CUBIC) {
			writer.cubic(coords, c, x, y, precision);
			x = coords[c + 4];
			y = coords[c + 5];
			c += 6;
			writer.join();
		} else if (verb === CLOSE && open) {
			writer.push(sx, sy);
			finish(writer, true, contours);
			writer = new ContourWriter();
			x = sx;
			y = sy;
			open = false;
		}
	}
	if (open) finish(writer, false, contours);
	const skeleton: Skeleton = { contours, fillRule: path.fillRule };
	if (!entries) {
		entries = new Map();
		cache.set(path, entries);
	}
	if (entries.size >= CACHE_LIMIT) {
		const first = entries.keys().next().value;
		if (first !== undefined) entries.delete(first);
	}
	entries.set(precision, skeleton);
	return skeleton;
}

/** 在轮廓上按弧长取点与单位切线；闭合轮廓按周长取模，开放轮廓钳制到两端。 */
export function pointAt(contour: Contour, s: number, out: Float64Array): void {
	const { points, arc, closed, length } = contour;
	const n = arc.length;
	if (n === 1) {
		out[0] = points[0];
		out[1] = points[1];
		out[2] = 1;
		out[3] = 0;
		return;
	}
	let d = s;
	if (closed && length > 0) d = ((s % length) + length) % length;
	else d = Math.max(0, Math.min(arc[n - 1], s));
	let lo = 0;
	let hi = n - 1;
	if (closed && d >= arc[n - 1]) lo = n - 1;
	else {
		while (hi - lo > 1) {
			const mid = (lo + hi) >> 1;
			if (arc[mid] <= d) lo = mid;
			else hi = mid;
		}
	}
	const next = lo + 1 < n ? lo + 1 : 0;
	const segLength = (lo + 1 < n ? arc[lo + 1] : length) - arc[lo];
	const ax = points[lo * 2];
	const ay = points[lo * 2 + 1];
	const dx = points[next * 2] - ax;
	const dy = points[next * 2 + 1] - ay;
	const t = segLength > 0 ? (d - arc[lo]) / segLength : 0;
	const l = Math.hypot(dx, dy) || 1;
	out[0] = ax + dx * t;
	out[1] = ay + dy * t;
	out[2] = dx / l;
	out[3] = dy / l;
}
