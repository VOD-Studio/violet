/**
 * 眼环几何库 —— 参数化生成闭合眼轮廓。
 *
 * 每个眼环是 48 个点组成的闭合轮廓,以 (0,0) 为中心、基准半径 1,
 * 渲染时乘以眼睛实际半径。所有生成器共享同一约定,眼环间任意切换
 * 都能逐点弹簧插值平滑变形。
 */

/** 眼环:48 个 [x, y] 点,中心在原点,基准半径 1。 */
export type EyeRing = readonly (readonly [number, number])[];

const N = 48;
const TAU = Math.PI * 2;

function sample(f: (t: number) => [number, number]): EyeRing {
	const pts: [number, number][] = [];
	for (let i = 0; i < N; i++) {
		const t = (i / N) * TAU;
		pts.push(f(t));
	}
	return pts;
}

/** 两点间沿参数 t 均匀取 48 点构成(极扁)闭合形,用于线状眼。 */
function fromEndpoints(a: [number, number], b: [number, number], width: number): EyeRing {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const len = Math.hypot(dx, dy) || 1;
	// 垂直方向单位向量
	const px = -dy / len;
	const py = dx / len;
	return sample((t) => {
		// t ∈ [0, 2π) 映射为线段往返:前半程 a→b 上沿,后半程 b→a 下沿
		const phase = (t / TAU) * 2;
		const s = phase < 1 ? phase : 2 - phase;
		const w = phase < 1 ? 1 : -1;
		return [a[0] + dx * s + px * width * w * 0.5, a[1] + dy * s + py * width * w * 0.5];
	});
}

function ellipseRing(rx: number, ry: number, rotate = 0): EyeRing {
	const cos = Math.cos(rotate);
	const sin = Math.sin(rotate);
	return sample((t) => {
		const x = Math.cos(t) * rx;
		const y = Math.sin(t) * ry;
		return [x * cos - y * sin, x * sin + y * cos];
	});
}

/**
 * 月牙环:两条二次贝塞尔围成闭合形。
 *
 * @param w - 半宽
 * @param bow - 弦到外弧的垂直距离,正值下弯(开心 ∪),负值上弯(难过 ∩)
 * @param thick - 月牙厚度
 */
function crescent(w: number, bow: number, thick: number): EyeRing {
	// 弦保持在中线附近,让月牙整体不偏出眼部
	const lift = -bow * 0.5;
	const p0: [number, number] = [-w, lift];
	const p1: [number, number] = [w, lift];
	const cOut: [number, number] = [0, lift + bow * 2];
	const cIn: [number, number] = [0, lift + bow * 2 - thick * 2];
	const q = (
		a: [number, number],
		c: [number, number],
		b: [number, number],
		s: number,
	): [number, number] => [
		(1 - s) * (1 - s) * a[0] + 2 * (1 - s) * s * c[0] + s * s * b[0],
		(1 - s) * (1 - s) * a[1] + 2 * (1 - s) * s * c[1] + s * s * b[1],
	];
	return sample((t) => {
		const phase = t / TAU;
		// 前半程走外弧,后半程走内弧,构成闭合月牙
		if (phase < 0.5) return q(p0, cOut, p1, phase * 2);
		return q(p1, cIn, p0, (phase - 0.5) * 2);
	});
}

/** 圆润星形:r(θ) = 1 + amp·cos(kθ),amp 足够小保证轮廓平滑。 */
function star(k: number, amp: number): EyeRing {
	return sample((t) => {
		const r = 0.85 + amp * Math.cos(k * t);
		return [Math.cos(t) * r, Math.sin(t) * r];
	});
}

/** 心形:经典参数方程,y 翻转适配 SVG 坐标系,归一化到基准半径。 */
function heart(): EyeRing {
	return sample((t) => {
		const x = 16 * Math.sin(t) ** 3;
		const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
		return [x / 17, (y + 2) / 17];
	});
}

export const EYE_RINGS = {
	/** 平静圆眼(默认) */
	round: ellipseRing(1, 1),
	/** 大圆睁眼(惊讶) */
	wide: ellipseRing(1.18, 1.24),
	/** 压扁椭圆(疲惫) */
	flat: ellipseRing(1.05, 0.72),
	/** 眯缝(睡眠/忍受) */
	slit: ellipseRing(1.05, 0.1),
	/** 小圆点(怀疑/心虚) */
	dot: ellipseRing(0.42, 0.42),
	/** 下弯月牙(开心 ∪) */
	smile: crescent(0.95, 0.62, 0.42),
	/** 更弯的下月牙(大笑) */
	grin: crescent(1.05, 0.8, 0.5),
	/** 上弯月牙(难过 ∩) */
	sad: crescent(0.9, -0.55, 0.4),
	/** 斜线眼(无奈 -) */
	uneasyA: fromEndpoints([-0.9, -0.35], [0.9, 0.35], 0.42),
	/** 反斜线眼 */
	uneasyB: fromEndpoints([-0.9, 0.35], [0.9, -0.35], 0.42),
	/** 内高外低斜椭圆(生气) */
	anger: ellipseRing(1.0, 0.78, -0.38),
	/** 内低外高斜椭圆(另一侧生气,组合成怒目) */
	angerMirror: ellipseRing(1.0, 0.78, 0.38),
	/** 一大一小圆(疑惑,配合左右不同尺寸) */
	small: ellipseRing(0.66, 0.66),
	/** 扫读窄椭圆(检索/阅读) */
	scan: ellipseRing(0.9, 0.5),
	/** 圆润四角星(兴奋/完成) */
	sparkle: star(4, 0.28),
	/** 心形(爱意) */
	heart: heart(),
	/** 下垂半闭(失落/困倦) */
	droop: ellipseRing(0.95, 0.58, 0),
	/** 调皮俏皮 Wink (>) */
	wink: crescent(0.95, 0.72, 0.38),
	/** 水汪汪乞求大眼 (Pleading) */
	pleading: ellipseRing(1.22, 1.28),
	/** 陶醉呼噜舒适眯眼 */
	purr: crescent(1.0, 0.52, 0.45),
	/** 委屈波浪眼 */
	tear: crescent(0.95, -0.65, 0.38),
	/** 嫌弃翻白眼 */
	disdain: crescent(0.9, -0.4, 0.45),
} as const satisfies Record<string, EyeRing>;

export type EyeShapeId = keyof typeof EYE_RINGS;
