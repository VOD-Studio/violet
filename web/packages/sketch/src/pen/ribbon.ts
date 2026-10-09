import { catmullRomToCubics } from "../core/path.ts";
import type { Stroke } from "../core/types.ts";

/** 椭圆笔尖：长轴方向与短长轴比；圆笔尖的 aspect 为 1。 */
export interface Nib {
	/** 长轴在场景坐标系中的角度，弧度。 */
	angle: number;
	/** 短轴与长轴之比，(0, 1]。 */
	aspect: number;
}

export interface RibbonOptions {
	/** 压力为 1 时笔尖长轴的全宽，场景单位。 */
	width: number;
	nib: Nib;
	/** 压力映射到宽度倍率：`min + (max − min) · p^gamma`。 */
	minScale: number;
	maxScale: number;
	gamma: number;
	/** 展平容差，场景单位。 */
	precision: number;
}

/** 变宽笔画的条带多边形，布局见 {@link import("../core/types.ts").InkBatch.ribbons}。 */
export interface Ribbon {
	/** 交错的 x、y，依次为左侧 n 点、末端帽 c 点、右侧 n 点（自末向首）、起端帽 c 点。 */
	readonly points: Float32Array;
	readonly n: number;
	readonly c: number;
}

const CAP_POINTS = 6;
// 相邻切线夹角超过该值时在外侧补圆弧，避免条带出现缺口。
const JOIN_STEP = 0.35;
// 压力沿笔画变化，直线段也至少每隔该长度取一个样本。
const MAX_GAP = 6;

interface Samples {
	x: number[];
	y: number[];
	p: number[];
}

function sampleStroke(stroke: Stroke, precision: number): Samples {
	const out: Samples = { x: [], y: [], p: [] };
	const push = (x: number, y: number, p: number) => {
		const last = out.x.length - 1;
		if (last >= 0 && Math.hypot(x - out.x[last], y - out.y[last]) < 1e-4) return;
		out.x.push(x);
		out.y.push(y);
		out.p.push(p);
	};
	const pts = stroke.points;
	const count = pts.length / 4;
	if (count < 1) return out;
	push(pts[0], pts[1], pts[2]);
	const polyline = (i: number) => {
		const ax = out.x[out.x.length - 1];
		const ay = out.y[out.y.length - 1];
		const bx = pts[i * 4];
		const by = pts[i * 4 + 1];
		const pa = out.p[out.p.length - 1];
		const pb = pts[i * 4 + 2];
		const parts = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / MAX_GAP));
		for (let k = 1; k <= parts; k++) {
			const t = k / parts;
			push(ax + (bx - ax) * t, ay + (by - ay) * t, pa + (pb - pa) * t);
		}
	};
	if (!stroke.curve || count < 3) {
		for (let i = 1; i < count; i++) polyline(i);
		return out;
	}
	catmullRomToCubics(pts, 4, (c, segment) => {
		const x0 = out.x[out.x.length - 1];
		const y0 = out.y[out.y.length - 1];
		const pa = pts[segment * 4 + 2];
		const pb = pts[(segment + 1) * 4 + 2];
		const chord = Math.hypot(c[4] - x0, c[5] - y0);
		// 弦高误差 ≈ |B''|/(8n²)，B'' 的上界取控制多边形二阶差分的六倍。
		const dd =
			6 *
			Math.max(
				Math.hypot(x0 - 2 * c[0] + c[2], y0 - 2 * c[1] + c[3]),
				Math.hypot(c[0] - 2 * c[2] + c[4], c[1] - 2 * c[3] + c[5]),
			);
		const n = Math.max(
			1,
			Math.ceil(Math.sqrt(dd / (8 * precision))),
			Math.ceil(chord / MAX_GAP),
		);
		const x1 = c[0];
		const y1 = c[1];
		const x2 = c[2];
		const y2 = c[3];
		const x3 = c[4];
		const y3 = c[5];
		for (let k = 1; k <= n; k++) {
			const t = k / n;
			const m = 1 - t;
			push(
				m * m * m * x0 + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * x3,
				m * m * m * y0 + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * y3,
				pa + (pb - pa) * t,
			);
		}
	});
	return out;
}

/**
 * 沿笔画求椭圆笔尖的扫掠轮廓，输出一个带圆帽的条带多边形。
 *
 * @returns 少于两个不同样本点时返回 null
 * @remarks 轮廓取笔尖在法向上的支撑点，对凸笔尖是精确的包络；大转角处在外侧补圆弧，内侧的自交由 nonzero 填充吸收。
 */
export function strokeRibbon(stroke: Stroke, o: RibbonOptions): Ribbon | null {
	const { x, y, p } = sampleStroke(stroke, o.precision);
	const count = x.length;
	if (count < 2) return null;

	const tx = new Float64Array(count);
	const ty = new Float64Array(count);
	for (let i = 0; i < count; i++) {
		const a = Math.max(0, i - 1);
		const b = Math.min(count - 1, i + 1);
		const dx = x[b] - x[a];
		const dy = y[b] - y[a];
		const l = Math.hypot(dx, dy) || 1;
		tx[i] = dx / l;
		ty[i] = dy / l;
	}

	const cos = Math.cos(o.nib.angle);
	const sin = Math.sin(o.nib.angle);
	const half = o.width / 2;
	const scaleAt = (pressure: number) =>
		o.minScale + (o.maxScale - o.minScale) * Math.max(0, pressure) ** o.gamma;

	// 笔尖在单位方向 (nx, ny) 上的支撑点相对笔尖中心的偏移。
	const support = (nx: number, ny: number, r: number, out: [number, number]) => {
		const lx = nx * cos + ny * sin;
		const ly = -nx * sin + ny * cos;
		const a = r;
		const b = r * o.nib.aspect;
		const d = Math.hypot(a * lx, b * ly) || 1;
		const sx = (a * a * lx) / d;
		const sy = (b * b * ly) / d;
		out[0] = sx * cos - sy * sin;
		out[1] = sx * sin + sy * cos;
	};

	const left: number[] = [];
	const right: number[] = [];
	const s: [number, number] = [0, 0];
	const emit = (i: number, nx: number, ny: number) => {
		support(nx, ny, half * scaleAt(p[i]), s);
		left.push(x[i] + s[0], y[i] + s[1]);
		right.push(x[i] - s[0], y[i] - s[1]);
	};

	for (let i = 0; i < count; i++) {
		const nx = -ty[i];
		const ny = tx[i];
		if (i > 0) {
			const turn = Math.atan2(
				tx[i - 1] * ty[i] - ty[i - 1] * tx[i],
				tx[i - 1] * tx[i] + ty[i - 1] * ty[i],
			);
			const steps = Math.floor(Math.abs(turn) / JOIN_STEP);
			// 在同一位置插入旋转中的法向，使左右两侧点数保持一致。
			const a0 = Math.atan2(tx[i - 1], -ty[i - 1]);
			for (let k = 1; k <= steps; k++) {
				const a = a0 + (turn * k) / (steps + 1);
				emit(i - 1, Math.cos(a), Math.sin(a));
			}
		}
		emit(i, nx, ny);
	}
	const n = left.length / 2;

	const cap = (i: number, from: number, sign: number, out: number[]) => {
		for (let k = 1; k <= CAP_POINTS; k++) {
			const a = from + sign * ((Math.PI * k) / (CAP_POINTS + 1));
			support(Math.cos(a), Math.sin(a), half * scaleAt(p[i]), s);
			out.push(x[i] + s[0], y[i] + s[1]);
		}
	};
	const last = count - 1;
	const endAngle = Math.atan2(tx[last], -ty[last]);
	const startAngle = Math.atan2(-tx[0], ty[0]);
	const endCap: number[] = [];
	const startCap: number[] = [];
	cap(last, endAngle, -1, endCap);
	cap(0, startAngle, -1, startCap);

	const total = (2 * n + 2 * CAP_POINTS) * 2;
	const points = new Float32Array(total);
	let w = 0;
	for (let i = 0; i < left.length; i++) points[w++] = left[i];
	for (let i = 0; i < endCap.length; i++) points[w++] = endCap[i];
	for (let i = n - 1; i >= 0; i--) {
		points[w++] = right[i * 2];
		points[w++] = right[i * 2 + 1];
	}
	for (let i = 0; i < startCap.length; i++) points[w++] = startCap[i];
	return { points, n, c: CAP_POINTS };
}
