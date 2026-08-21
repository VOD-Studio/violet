/**
 * 堇喵几何 —— 猫团轮廓、五官锚点、表面投影与嘴型。
 *
 * viewBox 0 0 260 260 坐标系:
 *   - 身体:近圆面团轮廓,上圆下阔,底部贴地
 *   - 猫耳:外耳廓 + 内耳窝,支持独立支点旋转(飞机耳/立耳)
 *   - 尾巴:身体后侧弯尾,随摆动参数与抬起高度摇曳
 *   - 小爪:胸前两只肉垫爪,支持独立支点位移与旋转(挥手/捂脸)
 *   - 嘴巴:多形态猫咪小嘴(ω 嘴/张嘴/小圆/撇嘴/吐舌)
 *   - 五官偏下半脸(y ≈ 142)
 */

/** 眼位、腮红、嘴巴与五官锚点参数。 */
export const FACE = {
	/** 左眼中心 */
	eyeL: [98, 142] as const,
	/** 右眼中心 */
	eyeR: [162, 142] as const,
	/** 基准眼半径 */
	eyeRadius: 16,
	/** 腮红中心 (左/右) */
	blushL: [74, 162] as const,
	blushR: [186, 162] as const,
	/** 猫咪小嘴中心 */
	mouth: [130, 156] as const,
	/** 左爪中心 */
	pawL: [104, 206] as const,
	/** 右爪中心 */
	pawR: [156, 206] as const,
	/** 左胡须锚点 */
	whiskerL: [64, 155] as const,
	/** 右胡须锚点 */
	whiskerR: [196, 155] as const,
};

const CX = 130;
/** 所有可绕身体表面旋转的部件共用的横向投影半径。 */
export const FACE_PROJECTION_RADIUS = 72;
/** 尾根连接身体表面的半径,使尾巴从轮廓边缘而不是团子中心冒出。 */
export const TAIL_ROOT_RADIUS = 92;
/** 尾根在基准姿态中的固定经度。 */
export const TAIL_ROOT_ANGLE = Math.PI - 0.72;

/** 身体表面投影结果。 */
export interface SurfaceProjection {
	/** 投影后的横向位置 */
	x: number;
	/** 相对基准姿态的横向缩放,带符号表示背面镜像 */
	sx: number;
	/** 投影后的深度,正值朝向观察者 */
	depth: number;
	/** 朝向观察者的可见度 */
	op: number;
}

/** 将基准经度沿同一条表面曲线投影到当前偏航角。 */
export function projectSurfaceAngle(
	theta0: number,
	phi: number,
	radius = FACE_PROJECTION_RADIUS,
): SurfaceProjection {
	const p = theta0 + phi;
	const depth = Math.cos(p);
	const baseDepth = Math.max(Math.cos(theta0), 0.16);
	return {
		x: CX + radius * Math.sin(p),
		sx: Math.max(-1, Math.min(1, depth / baseDepth)),
		depth,
		op: Math.max(0, Math.min(1, depth / 0.16)),
	};
}

/** 从基准姿态的横向锚点反推出表面经度。 */
export function surfaceAngleForX(x0: number, radius = FACE_PROJECTION_RADIUS): number {
	return Math.asin(Math.max(-1, Math.min(1, (x0 - CX) / radius)));
}

/**
 * 折线转平滑闭合 path (Catmull-Rom 转三次贝塞尔,闭合)。
 *
 * 带角点保持:某顶点处折线方向变化超过阈值(60°)时视为硬角,
 * 该点切线清零(控制点回缩到顶点本身),样条不再强行圆化——
 * 否则月牙端尖会被过冲成鼓包、矩形直角被吹成方块(视觉呈"长方形眼")。
 */
export function smoothClosedPath(pts: readonly (readonly [number, number])[]): string {
	const n = pts.length;
	if (n < 3) return "";
	const CORNER_TURN = Math.PI / 3;
	const corner: boolean[] = [];
	for (let i = 0; i < n; i++) {
		const a = pts[(i - 1 + n) % n];
		const b = pts[i];
		const c = pts[(i + 1) % n];
		const v1x = b[0] - a[0];
		const v1y = b[1] - a[1];
		const v2x = c[0] - b[0];
		const v2y = c[1] - b[1];
		const l1 = Math.hypot(v1x, v1y);
		const l2 = Math.hypot(v2x, v2y);
		if (l1 < 1e-6 || l2 < 1e-6) {
			corner.push(false);
			continue;
		}
		const dot = (v1x * v2x + v1y * v2y) / (l1 * l2);
		corner.push(Math.acos(Math.min(1, Math.max(-1, dot))) > CORNER_TURN);
	}
	let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
	for (let i = 0; i < n; i++) {
		const p0 = pts[(i - 1 + n) % n];
		const p1 = pts[i];
		const p2 = pts[(i + 1) % n];
		const p3 = pts[(i + 2) % n];
		const c1: [number, number] = corner[i]
			? [p1[0], p1[1]]
			: [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
		const c2: [number, number] = corner[(i + 1) % n]
			? [p2[0], p2[1]]
			: [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
		d += ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)}, ${c2[0].toFixed(2)} ${c2[1].toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
	}
	return `${d} Z`;
}

/**
 * 猫猫面团轮廓 —— 64 点平滑闭合轮廓。
 * 顶部圆润微拱、侧腹饱满微扁、底部稳实贴地。
 */
export function catMochiOutline(): [number, number][] {
	// 8 个关键控制点定义团子形态
	const anchors: [number, number][] = [
		[CX, 68], // 顶部正中
		[188, 86], // 右上额
		[226, 152], // 右侧最宽处
		[212, 214], // 右下贴地过渡
		[CX, 226], // 底部正中
		[48, 214], // 左下贴地过渡
		[34, 152], // 左侧最宽处
		[72, 86], // 左上额
	];

	const n = 64;
	const pts: [number, number][] = [];
	const segs = anchors.length;
	for (let i = 0; i < n; i++) {
		const t = (i / n) * segs;
		const idx = Math.floor(t);
		const s = t - idx;
		const p0 = anchors[(idx - 1 + segs) % segs];
		const p1 = anchors[idx % segs];
		const p2 = anchors[(idx + 1) % segs];
		const p3 = anchors[(idx + 2) % segs];

		// Catmull-Rom 采样
		const s2 = s * s;
		const s3 = s2 * s;
		const x =
			0.5 *
			(2 * p1[0] +
				(-p0[0] + p2[0]) * s +
				(2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * s2 +
				(-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * s3);
		const y =
			0.5 *
			(2 * p1[1] +
				(-p0[1] + p2[1]) * s +
				(2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * s2 +
				(-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * s3);
		pts.push([x, y]);
	}
	return pts;
}

/** 猫耳几何定义与旋转支点。 */
export const CAT_EARS = {
	left: {
		pivot: [80, 88] as const,
		/** 外耳闭合路径:耳根圆盘深扎身体内部,防止与头部断层 */
		outerD: "M 58 78 C 54 62, 58 44, 68 36 C 72 32, 78 33, 81 38 C 88 48, 96 62, 104 74 C 108 92, 100 114, 80 116 C 60 114, 54 94, 58 78 Z",
		/** 内耳耳窝 */
		innerD: "M 64 74 C 62 60, 64 48, 70 42 C 73 39, 76 40, 78 43 C 83 50, 90 62, 96 72 C 98 84, 92 98, 80 100 C 68 98, 64 86, 64 74 Z",
	},
	right: {
		pivot: [180, 88] as const,
		/** 外耳闭合路径 */
		outerD: "M 202 78 C 206 62, 202 44, 192 36 C 188 32, 182 33, 179 38 C 172 48, 164 62, 156 74 C 152 92, 160 114, 180 116 C 200 114, 206 94, 202 78 Z",
		/** 内耳耳窝 */
		innerD: "M 196 74 C 198 60, 196 48, 190 42 C 187 39, 184 40, 182 43 C 177 50, 170 62, 164 72 C 162 84, 168 98, 180 100 C 192 98, 196 86, 196 74 Z",
	},
};

/**
 * 猫尾巴 path：从身体右后方延伸出并向上扬起。
 *
 * @param sway - 尾巴摇晃量 [-1, 1]
 * @param elevation - 尾巴抬升高度 [-1, 1]，正值高高竖起，负值低垂
 */
export function catTailPath(sway: number, elevation = 0, phi = 0, r = TAIL_ROOT_RADIUS): string {
	// 尾根使用与五官相同的显式背面经度,避免另起一套旋转坐标。
	const baseAngle = TAIL_ROOT_ANGLE;
	const root = projectSurfaceAngle(baseAngle, phi, r);
	const tailSx = Math.max(0.08, Math.abs(root.sx));
	const tailSy = 0.35 + tailSx * 0.65;
	const rootY = 192;
	const liftY = elevation * 22;
	const sideDir = Math.sin(baseAngle + phi) >= 0 ? 1 : -1;
	const reach = (32 + Math.abs(Math.sin(baseAngle + phi)) * 12 + sway * 16 * sideDir) * tailSx;
	const tipX = root.x + sideDir * reach;
	const tipY = rootY + (138 - Math.abs(sway) * 8 - liftY - rootY) * tailSy;
	const c1x = root.x + sideDir * (reach * 0.4);
	const c1y = rootY + (202 - liftY * 0.4 - rootY) * tailSy;
	const c2x = root.x + sideDir * (reach * 0.9);
	const c2y = rootY + (168 - liftY * 0.8 - rootY) * tailSy;

	return `M ${root.x.toFixed(2)} ${rootY.toFixed(2)} C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${tipX.toFixed(2)} ${tipY.toFixed(2)}`;
}

/** 猫咪胡须路径定义。 */
export const CAT_WHISKERS = {
	leftUpper: "M 56 150 Q 66 152 74 153",
	leftLower: "M 54 160 Q 65 160 74 158",
	rightUpper: "M 186 153 Q 194 152 204 150",
	rightLower: "M 186 158 Q 195 160 206 160",
};

/** 猫咪嘴型定义。 */
export type MouthShapeId = "w" | "smile" | "open" | "o" | "pout" | "tongue" | "flat" | "hidden";

export interface MouthGeometry {
	lineD: string;
	fillD?: string;
	tongueD?: string;
}

export const MOUTH_SHAPES: Record<MouthShapeId, MouthGeometry> = {
	/** 经典双瓣 ω 嘴 */
	w: {
		lineD: "M 124 154 Q 127 157.5 130 155 Q 133 157.5 136 154",
	},
	/** 微笑张嘴(含舌头) */
	smile: {
		lineD: "M 124 153 Q 130 162 136 153 Z",
		fillD: "M 124 153 Q 130 162 136 153 Z",
		tongueD: "M 127 157.5 Q 130 155.5 133 157.5 Q 130 161.5 127 157.5 Z",
	},
	/** 狂喜 / 大笑 / 哈欠张嘴 */
	open: {
		lineD: "M 123 151 Q 130 166 137 151 Z",
		fillD: "M 123 151 Q 130 166 137 151 Z",
		tongueD: "M 126 158 Q 130 155 134 158 Q 130 165.5 126 158 Z",
	},
	/** 小圆嘴(惊讶 / 疑惑 / 吹气) */
	o: {
		lineD: "M 130 152 A 3.6 4.5 0 1 0 130 161 A 3.6 4.5 0 1 0 130 152 Z",
		fillD: "M 130 152 A 3.6 4.5 0 1 0 130 161 A 3.6 4.5 0 1 0 130 152 Z",
	},
	/** 委屈 / 难过 / 撇嘴(倒 ω 嘴) */
	pout: {
		lineD: "M 124 157 Q 127 153.5 130 156 Q 133 153.5 136 157",
	},
	/** 调皮吐舌 */
	tongue: {
		lineD: "M 124 154 Q 127 156.5 130 155 Q 133 156.5 136 154",
		tongueD: "M 127.5 155.5 C 127.5 161.5, 132.5 161.5, 132.5 155.5 Z",
	},
	/** 一字平嘴(发呆 / 专注 / 忍耐) */
	flat: {
		lineD: "M 125 156 Q 130 155.5 135 156",
	},
	/** 隐去嘴巴(捂脸等) */
	hidden: {
		lineD: "",
	},
};
