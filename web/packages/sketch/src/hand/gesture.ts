import { pointAt } from "../core/flatten.ts";
import { channel } from "../core/rng.ts";
import type { DrawContext, Stroke } from "../core/types.ts";
import type { StrokePlan } from "./plan.ts";

const LOW = channel("sketch:gesture:low");
const LOW_OFFSET = channel("sketch:gesture:low-offset");
const HIGH = channel("sketch:gesture:high");
const BOW = channel("sketch:gesture:bow");
const END = channel("sketch:gesture:end");
const RETRACE = channel("sketch:gesture:retrace");

/** 单笔运动参数。 */
export interface GestureOptions {
	/** 粗糙度：低频法向位移的幅度，场景单位。 */
	roughness: number;
	/** 整笔弯曲幅度的倍率。 */
	bowing: number;
}

// 控制点间切线夹角超过该值时细分，避免 Catmull-Rom 抹圆原有曲线。
const REFINE_COS = Math.cos((30 * Math.PI) / 180);
const MAX_CONTROLS = 256;
const INCOMING = 1e-6;

/** 最小 jerk 位置曲线：τ∈[0,1] 时从 0 平滑到 1，两端速度与加速度为 0。 */
export function minimumJerk(t: number): number {
	return t * t * t * (10 + t * (6 * t - 15));
}

// 短线在感知上更接近直线（AlMeraj 2008），控制点更稀。
function spacing(length: number): number {
	if (length <= 200) return 80;
	if (length <= 400) return 60;
	return 45;
}

function smoothstep(x: number): number {
	const t = Math.max(0, Math.min(1, x));
	return t * t * (3 - 2 * t);
}

const pos = new Float64Array(4);

/**
 * 按最小 jerk 轨迹沿规划笔画生成 Catmull-Rom 控制点并施加法向位移。
 *
 * @param time - 本笔起始时间；时间单位为弧长，等 τ 步长对应钟形落笔速度
 * @returns 曲线笔画；首点时间为 time，末点时间为 time + 笔画全长
 */
export function traceStroke(
	plan: StrokePlan,
	ctx: DrawContext,
	options: GestureOptions,
	time: number,
): Stroke {
	const { contour, start, end, extendStart: e0, extendEnd: e1 } = plan;
	const span = end - start;
	const total = span + e0 + e1;
	const w = ctx.width;

	const position = (u: number) => {
		if (u < 0) {
			pointAt(contour, start, pos);
			pos[0] += pos[2] * u;
			pos[1] += pos[3] * u;
		} else if (u >= span - INCOMING) {
			// 终点取入射切线：角点处 pointAt 返回的是下一段的出射方向。
			pointAt(contour, end - INCOMING, pos);
			pos[0] += pos[2] * (u - span + INCOMING);
			pos[1] += pos[3] * (u - span + INCOMING);
		} else pointAt(contour, start + u, pos);
	};

	// 控制点按 [τ, u, x, y, tx, ty] 存放：u 为距本笔起点（含越界）的弧长，位置与切线只求一次。
	const S = 6;
	const samples: number[] = [];
	const insert = (at: number, tau: number, u: number) => {
		position(u - e0);
		if (at === samples.length) samples.push(tau, u, pos[0], pos[1], pos[2], pos[3]);
		else samples.splice(at, 0, tau, u, pos[0], pos[1], pos[2], pos[3]);
	};
	// 角点由下方的近邻控制点处理，细分跳过含角点的区间，否则会一直二分到线宽量级。
	const cornerU: number[] = [];
	for (let k = 0; k < contour.corners.length; k++) {
		const c = contour.arc[contour.corners[k]] - start + e0;
		if (c > 0 && c < total) cornerU.push(c);
		// 闭合轮廓的笔画可越过起点，再检查一圈后的同一角点。
		if (contour.closed && c + contour.length < total) cornerU.push(c + contour.length);
	}
	const hasCorner = (a: number, b: number) => cornerU.some((c) => c > a && c < b);
	const base = Math.max(1, Math.ceil(total / spacing(total)));
	for (let i = 0; i <= base; i++) insert(samples.length, i / base, minimumJerk(i / base) * total);
	for (let i = 0; i + S < samples.length && samples.length < MAX_CONTROLS * S; ) {
		const turn = samples[i + 4] * samples[i + S + 4] + samples[i + 5] * samples[i + S + 5];
		if (
			turn < REFINE_COS &&
			samples[i + S + 1] - samples[i + 1] > w &&
			!hasCorner(samples[i + 1], samples[i + S + 1])
		) {
			const tau = (samples[i] + samples[i + S]) / 2;
			insert(i + S, tau, minimumJerk(tau) * total);
		} else i += S;
	}
	// 角点前后各加一个近邻控制点，保持转角锐利。
	for (const c of cornerU) {
		for (let k = -1; k <= 1; k++) {
			const u = c + k * 1.2 * w;
			if (u <= 0 || u >= total) continue;
			let j = S;
			while (j < samples.length && samples[j + 1] < u) j += S;
			const u0 = samples[j - S + 1];
			const u1 = samples[j + 1];
			if (Math.abs(u - u0) < 0.3 * w || Math.abs(u1 - u) < 0.3 * w) continue;
			const tau = samples[j - S] + ((samples[j] - samples[j - S]) * (u - u0)) / (u1 - u0);
			insert(j, tau, u);
		}
	}

	const key = plan.key;
	const strokeKey = key * 8 + plan.pass;
	const lowChannel = LOW ^ Math.imul(plan.contourIndex + 1, 0x9e3779b1);
	const lowOffset = ctx.random(LOW_OFFSET, plan.contourIndex) * 1000;
	const amplitude = options.roughness * Math.min(1.4, Math.max(0.35, Math.sqrt(total / 120)));
	const lambda = Math.min(260, Math.max(60, total * 0.6));
	const bow =
		options.bowing * (ctx.random(BOW, strokeKey) * 2 - 1) * Math.min(total, 300) * 0.008;
	const retrace = plan.pass ? amplitude * 0.6 * (ctx.random(RETRACE, strokeKey) * 2 - 1) : 0;
	const pinLength = Math.min(12 * w, 0.2 * total);
	// 起落笔误差在端部一段距离内平滑衰减，只加在端点会因首尾控制点密集而形成钩子。
	const jitter = options.roughness * w * 0.4;
	const ramp = Math.min(0.3 * total, 40);
	const endKey = strokeKey * 4;
	const startNormal = jitter * (ctx.random(END, endKey) * 2 - 1);
	const startTangent = jitter * (ctx.random(END, endKey + 1) * 2 - 1);
	const endNormal = jitter * (ctx.random(END, endKey + 2) * 2 - 1);
	const endTangent = jitter * (ctx.random(END, endKey + 3) * 2 - 1);

	const count = samples.length / S;
	const points = new Float32Array(count * 4);
	for (let i = 0; i < count; i++) {
		const tau = samples[i * S];
		const u = samples[i * S + 1];
		const px = samples[i * S + 2];
		const py = samples[i * S + 3];
		const tx = samples[i * S + 4];
		const ty = samples[i * S + 5];
		const s = start + u - e0;
		const head = 1 - smoothstep(u / ramp);
		const tail = 1 - smoothstep((total - u) / ramp);
		let d =
			amplitude * ctx.noise(lowChannel, s / lambda + lowOffset) +
			amplitude * 0.3 * ctx.noise(HIGH ^ strokeKey, u / (lambda * 0.25)) +
			bow * Math.sin(Math.PI * minimumJerk(tau)) +
			retrace +
			startNormal * head +
			endNormal * tail;
		let tangent = startTangent * head + endTangent * tail;
		let envelope = 1;
		if (plan.pinStart) envelope *= smoothstep(u / pinLength);
		if (plan.pinEnd) envelope *= smoothstep((total - u) / pinLength);
		d *= envelope;
		tangent *= envelope;
		points[i * 4] = px - ty * d + tx * tangent;
		points[i * 4 + 1] = py + tx * d + ty * tangent;
		points[i * 4 + 2] = 1;
		points[i * 4 + 3] = time + tau * total;
	}
	return { points, curve: true, closed: false, pass: plan.pass };
}
