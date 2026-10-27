/**
 * 枝条生长的纯几何模型：种子随机可复现，SSR 与客户端得到同一棵树。
 *
 * 枝条用中心线加宽度描述，随时间参数排布花叶着生点（tip 与 node），
 * 供场景组件把花瓣、叶片、积雪放到枝条经过的位置与时刻。
 */

export type Pt = [number, number];

/** 32 位种子随机数生成器，相同种子总得到相同序列。 */
export function mulberry32(seed: number) {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** 一段枝条：中心线各点、对应宽度与入场动画的时刻。 */
export interface Limb {
	points: Pt[];
	widths: number[];
	depth: number;
	start: number;
	duration: number;
}

/** 枝条上可着生花叶的位置与该位置被生长经过的时刻。 */
export interface Spot {
	at: Pt;
	angle: number;
	width: number;
	time: number;
	depth: number;
}

export interface Tree {
	limbs: Limb[];
	tips: Spot[];
	nodes: Spot[];
}

/** 主干的生长速度（像素/秒），决定整棵树的入场节奏。 */
const GROW_SPEED = 320;

/**
 * 从一点出发递归生长一棵树。
 *
 * @param children - 主干分叉数；子级逐层减一
 * @param startAt - 主干开始生长的延迟秒数，远景枝条用它错开入场
 */
export function growTree(
	seed: number,
	origin: Pt,
	angle: number,
	length: number,
	width: number,
	depth: number,
	children = 3,
	startAt = 0.2,
): Tree {
	const r = mulberry32(seed);
	const tree: Tree = { limbs: [], tips: [], nodes: [] };
	const grow = (
		start: Pt,
		startAngle: number,
		len: number,
		w: number,
		level: number,
		t0: number,
	) => {
		const steps = Math.max(4, Math.round(len / 14));
		const points: Pt[] = [start];
		const widths = [w];
		const angles = [startAngle];
		let a = startAngle;
		let [x, y] = start;
		const bias = (r() - 0.5) * 0.05;
		for (let i = 1; i <= steps; i++) {
			a += bias + (r() - 0.5) * 0.24;
			x += Math.cos(a) * (len / steps);
			y += Math.sin(a) * (len / steps);
			points.push([x, y]);
			widths.push(Math.max(0.8, w * (1 - (i / steps) * 0.82)));
			angles.push(a);
		}
		const duration = (len / GROW_SPEED) * (level === 0 ? 1 : 1.25);
		tree.limbs.push({ points, widths, depth: level, start: t0, duration });
		tree.tips.push({
			at: points[steps],
			angle: a,
			width: widths[steps],
			time: t0 + duration,
			depth: level,
		});
		for (let i = 2; i < steps; i++)
			tree.nodes.push({
				at: points[i],
				angle: angles[i],
				width: widths[i],
				time: t0 + duration * (i / steps) ** 0.8,
				depth: level,
			});
		if (level >= depth) return;
		const count = level === 0 ? children : Math.max(1, children - 1);
		for (let c = 0; c < count; c++) {
			const index = 1 + Math.floor(r() * (steps - 2));
			const side = c % 2 === 0 ? -1 : 1;
			grow(
				points[index],
				angles[index] + side * (0.42 + r() * 0.5),
				len * (0.3 + r() * 0.32) * (1 - (index / steps) * 0.4),
				widths[index] * 0.6,
				level + 1,
				t0 + duration * (index / steps) ** 0.8,
			);
		}
	};
	grow(origin, angle, length, width, 0, startAt);
	return tree;
}

/** 用中点二次贝塞尔平滑折线，保留端点。 */
export function smoothThrough(points: Pt[]): string {
	let d = "";
	for (let i = 1; i < points.length - 1; i++) {
		const [x, y] = points[i];
		const [nx, ny] = points[i + 1];
		d += ` Q${x.toFixed(1)},${y.toFixed(1)} ${((x + nx) / 2).toFixed(1)},${((y + ny) / 2).toFixed(1)}`;
	}
	const last = points[points.length - 1];
	return `${d} L${last[0].toFixed(1)},${last[1].toFixed(1)}`;
}

/** 枝条中心线 path，配合 pathLength=1 做描边遮罩。 */
export const centerline = (points: Pt[]) =>
	`M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}${smoothThrough(points)}`;

/** 折线某点的单位法向量，供生成带宽度的轮廓。 */
export function normalAt(points: Pt[], i: number): Pt {
	const [ax, ay] = points[Math.max(0, i - 1)];
	const [bx, by] = points[Math.min(points.length - 1, i + 1)];
	const length = Math.hypot(bx - ax, by - ay) || 1;
	return [-(by - ay) / length, (bx - ax) / length];
}

/** 沿中心线两侧偏移半宽，得到收细枝条的闭合轮廓。 */
export function taperedPath({ points, widths }: Pick<Limb, "points" | "widths">): string {
	const left: Pt[] = [];
	const right: Pt[] = [];
	points.forEach(([x, y], i) => {
		const [nx, ny] = normalAt(points, i);
		const half = widths[i] / 2;
		left.push([x + nx * half, y + ny * half]);
		right.push([x - nx * half, y - ny * half]);
	});
	const back = right.reverse();
	return `M${left[0][0].toFixed(1)},${left[0][1].toFixed(1)}${smoothThrough(left)} L${back[0][0].toFixed(1)},${back[0][1].toFixed(1)}${smoothThrough(back)} Z`;
}

/**
 * 枝条上的积雪轮廓：只在接近水平（法向量 x 分量小）的段落堆厚，垂直段挂不住。
 *
 * @returns 可画的 path；整段都挂不住时返回 null
 */
export function snowPath({ points, widths }: Limb, seed: number): string | null {
	const r = mulberry32(seed);
	const top: Pt[] = [];
	const bottom: Pt[] = [];
	let total = 0;
	points.forEach(([x, y], i) => {
		const [nx] = normalAt(points, i);
		const flat = Math.abs(nx) < 0.5 ? 1 - Math.abs(nx) * 1.7 : 0;
		const thick = flat * (2 + r() * 3 + widths[i] * 0.3);
		total += thick;
		top.push([x, y - widths[i] / 2 - thick]);
		bottom.push([x, y - widths[i] * 0.1]);
	});
	if (total < 5) return null;
	const back = bottom.reverse();
	return `M${top[0][0].toFixed(1)},${top[0][1].toFixed(1)}${smoothThrough(top)} L${back[0][0].toFixed(1)},${back[0][1].toFixed(1)}${smoothThrough(back)} Z`;
}

/** 弧度转角度，供 SVG rotate 属性。 */
export const deg = (radians: number) => (radians * 180) / Math.PI;
