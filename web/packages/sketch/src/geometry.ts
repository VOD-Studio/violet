import { absolutize, parsePath } from "path-data-parser";
import type { Budget, Command, Contour, Geometry, Sample } from "./types.ts";

const sampled = new WeakMap<Geometry, Map<string, readonly Contour[]>>();

interface Arc {
	cx: number;
	cy: number;
	rx: number;
	ry: number;
	phi: number;
	start: number;
	sweep: number;
}

function arc(x: number, y: number, v: readonly number[]): Arc | null {
	let [rx, ry] = v;
	rx = Math.abs(rx);
	ry = Math.abs(ry);
	const phi = (v[2] * Math.PI) / 180;
	const ex = v[5],
		ey = v[6];
	if (!rx || !ry || (x === ex && y === ey)) return null;
	const c = Math.cos(phi),
		s = Math.sin(phi);
	const px = (c * (x - ex)) / 2 + (s * (y - ey)) / 2;
	const py = (-s * (x - ex)) / 2 + (c * (y - ey)) / 2;
	const scale = (px * px) / (rx * rx) + (py * py) / (ry * ry);
	if (scale > 1) {
		const k = Math.sqrt(scale);
		rx *= k;
		ry *= k;
	}
	const numerator = Math.max(0, rx * rx * ry * ry - rx * rx * py * py - ry * ry * px * px);
	const denominator = rx * rx * py * py + ry * ry * px * px;
	const k = (v[3] === v[4] ? -1 : 1) * Math.sqrt(numerator / denominator);
	const cxp = (k * rx * py) / ry,
		cyp = (-k * ry * px) / rx;
	const ux = (px - cxp) / rx,
		uy = (py - cyp) / ry;
	const vx = (-px - cxp) / rx,
		vy = (-py - cyp) / ry;
	let sweep = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
	if (!v[4] && sweep > 0) sweep -= 2 * Math.PI;
	if (v[4] && sweep < 0) sweep += 2 * Math.PI;
	return {
		cx: c * cxp - s * cyp + (x + ex) / 2,
		cy: s * cxp + c * cyp + (y + ey) / 2,
		rx,
		ry,
		phi,
		start: Math.atan2(uy, ux),
		sweep,
	};
}

/**
 * 解析 SVG 路径，将相对、平滑与轴向命令转换为显式绝对命令并保留曲线。
 *
 * @param fillRule - 填充及孔洞判定规则，缺省为 nonzero
 * @returns 由 geometryFromCommands 构造的几何，序列化文本不保留原始格式
 * @remarks 解析器错误直接向调用方传播，不修复无效路径。
 */
export function geometryFromPath(d: string, fillRule: Geometry["fillRule"] = "nonzero"): Geometry {
	const commands: Command[] = [];
	let x = 0,
		y = 0,
		sx = 0,
		sy = 0,
		cx = 0,
		cy = 0,
		previous = "";
	for (const segment of absolutize(parsePath(d))) {
		const v = segment.data;
		switch (segment.key) {
			case "M":
				commands.push({ op: "M", values: v });
				[x, y] = v;
				sx = x;
				sy = y;
				break;
			case "L":
				commands.push({ op: "L", values: v });
				[x, y] = v;
				break;
			case "H":
				x = v[0];
				commands.push({ op: "L", values: [x, y] });
				break;
			case "V":
				y = v[0];
				commands.push({ op: "L", values: [x, y] });
				break;
			case "C":
				commands.push({ op: "C", values: v });
				[cx, cy] = v.slice(2, 4);
				[x, y] = v.slice(4);
				break;
			case "S": {
				const reflect = previous === "C" || previous === "S";
				commands.push({
					op: "C",
					values: [reflect ? 2 * x - cx : x, reflect ? 2 * y - cy : y, ...v],
				});
				[cx, cy] = v;
				[x, y] = v.slice(2);
				break;
			}
			case "Q":
				commands.push({ op: "Q", values: v });
				[cx, cy] = v;
				[x, y] = v.slice(2);
				break;
			case "T": {
				const reflect = previous === "Q" || previous === "T";
				cx = reflect ? 2 * x - cx : x;
				cy = reflect ? 2 * y - cy : y;
				commands.push({ op: "Q", values: [cx, cy, ...v] });
				[x, y] = v;
				break;
			}
			case "A":
				commands.push({ op: "A", values: v });
				x = v[5];
				y = v[6];
				break;
			case "Z":
				commands.push({ op: "Z", values: [] });
				x = sx;
				y = sy;
				break;
		}
		previous = segment.key;
	}
	return geometryFromCommands(commands, fillRule);
}

/**
 * 从绝对路径命令构造几何及保守包围盒。
 *
 * @param commands - 须提供有效且坐标有限的命令；直接复用数组及其内容，不复制或校验
 * @param fillRule - 填充及孔洞判定规则，缺省为 nonzero
 * @returns commands 保留原精度，d 中数值四舍五入至四位小数的几何
 * @remarks bounds 包含贝塞尔控制点及圆弧的保守范围，并非紧致包围盒；空命令返回零包围盒。
 * closed 仅表示存在任意 Z，不保证全部子路径闭合。构造后不得修改命令，否则 d、bounds 与采样缓存会失效。
 */
export function geometryFromCommands(
	commands: readonly Command[],
	fillRule: Geometry["fillRule"] = "nonzero",
): Geometry {
	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity,
		x = 0,
		y = 0,
		sx = 0,
		sy = 0;
	const include = (px: number, py: number) => {
		minX = Math.min(minX, px);
		minY = Math.min(minY, py);
		maxX = Math.max(maxX, px);
		maxY = Math.max(maxY, py);
	};
	for (const command of commands) {
		const v = command.values;
		if (command.op === "A") {
			const a = arc(x, y, v);
			if (a) {
				const r = Math.max(a.rx, a.ry);
				include(a.cx - r, a.cy - r);
				include(a.cx + r, a.cy + r);
			}
			x = v[5];
			y = v[6];
			include(x, y);
		} else if (command.op === "Z") {
			x = sx;
			y = sy;
		} else {
			for (let i = 0; i < v.length; i += 2) include(v[i], v[i + 1]);
			x = v[v.length - 2];
			y = v[v.length - 1];
			if (command.op === "M") {
				sx = x;
				sy = y;
			}
		}
	}
	return {
		commands,
		d: commands
			.map((c) => c.op + c.values.map((n) => String(Math.round(n * 10000) / 10000)).join(" "))
			.join(""),
		bounds: {
			x: Number.isFinite(minX) ? minX : 0,
			y: Number.isFinite(minY) ? minY : 0,
			width: Number.isFinite(maxX) ? maxX - minX : 0,
			height: Number.isFinite(maxY) ? maxY - minY : 0,
		},
		fillRule,
		closed: commands.some((c) => c.op === "Z"),
	};
}

/**
 * 按输入顺序连接场景坐标点，生成折线或闭合多边形。
 *
 * @param closed - 缺省为 false；为 true 时追加 Z，不校验点数或首尾重复
 * @returns 使用 nonzero 填充规则的几何；空点列不会生成 M
 */
export function polyline(points: readonly { x: number; y: number }[], closed = false): Geometry {
	const commands: Command[] = points.map((p, i) => ({
		op: i === 0 ? "M" : "L",
		values: [p.x, p.y],
	}));
	if (closed) commands.push({ op: "Z", values: [] });
	return geometryFromCommands(commands);
}

/**
 * 用两段圆弧构造以指定场景坐标为圆心的闭合圆。
 *
 * @param r - 场景单位半径，应为有限非负数；零值生成退化圆，不执行参数校验
 */
export function circleGeometry(x: number, y: number, r: number): Geometry {
	return geometryFromCommands([
		{ op: "M", values: [x - r, y] },
		{ op: "A", values: [r, r, 0, 1, 0, x + r, y] },
		{ op: "A", values: [r, r, 0, 1, 0, x - r, y] },
		{ op: "Z", values: [] },
	]);
}

/**
 * 在场景坐标中构造带二次曲线圆角的闭合矩形。
 *
 * @param w - 场景单位宽度，应为有限非负数
 * @param h - 场景单位高度，应为有限非负数
 * @param radius - 圆角控制距离，缺省为 0，钳制到零与较短边一半之间；圆角不是精确圆弧
 * @remarks 不校验参数，宽高为零时仍保留退化路径命令。
 */
export function rectangleGeometry(
	x: number,
	y: number,
	w: number,
	h: number,
	radius = 0,
): Geometry {
	const r = Math.max(0, Math.min(radius, w / 2, h / 2));
	return geometryFromCommands([
		{ op: "M", values: [x + r, y] },
		{ op: "L", values: [x + w - r, y] },
		{ op: "Q", values: [x + w, y, x + w, y + r] },
		{ op: "L", values: [x + w, y + h - r] },
		{ op: "Q", values: [x + w, y + h, x + w - r, y + h] },
		{ op: "L", values: [x + r, y + h] },
		{ op: "Q", values: [x, y + h, x, y + h - r] },
		{ op: "L", values: [x, y + r] },
		{ op: "Q", values: [x, y, x + r, y] },
		{ op: "Z", values: [] },
	]);
}

function distance(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
	const dx = bx - ax,
		dy = by - ay,
		n = dx * dx + dy * dy;
	const u = n ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / n)) : 0;
	return Math.hypot(x - ax - u * dx, y - ay - u * dy);
}

/**
 * 将几何各子路径细分为带近似弧长、归一化进度及单位切线的轮廓。
 *
 * @param maxStep - 场景单位的采样步长上限，须为有限正数，缺省为 4
 * @param precision - 场景单位的局部曲线细分容差，须为有限正数，缺省为 0.3；不是后续笔迹的全局误差界
 * @param budget - 可选共享预算；缓存命中仍按返回点数累计采样开销
 * @returns 共享的只读轮廓；闭合轮廓通常包含重复的首尾位置，弧长按采样折线累计
 * @remarks 按 geometry 对象身份缓存，最多保留四组 maxStep/precision，满额时淘汰最早插入项。
 * 不校验采样参数，也不允许修改输入命令或返回数据。
 * @throws {@link RangeError} 当单路径采样超过 100000 点或贝塞尔细分深度超过 24。
 * @throws 当共享预算耗尽时，传播 budget 抛出的错误，不放宽容差。
 */
export function sampleGeometry(
	geometry: Geometry,
	maxStep = 4,
	precision = 0.3,
	budget?: Budget,
): readonly Contour[] {
	const key = `${maxStep}:${precision}`;
	const cache = sampled.get(geometry);
	const hit = cache?.get(key);
	if (hit) {
		budget?.addSamples(hit.reduce((n, c) => n + c.points.length, 0));
		return hit;
	}
	const contours: Contour[] = [];
	let raw: { x: number; y: number }[] = [],
		closed = false,
		x = 0,
		y = 0,
		sx = 0,
		sy = 0,
		count = 0;
	const append = (px: number, py: number) => {
		const last = raw[raw.length - 1];
		if (last && Math.hypot(px - last.x, py - last.y) < 1e-9) return;
		budget?.addSamples(1);
		if (++count > 100000) throw new RangeError("原型单路径采样上限为 100000；未降低精度");
		raw.push({ x: px, y: py });
	};
	const finish = () => {
		if (!raw.length) return;
		let length = 0;
		const points: Sample[] = raw.map((p, i) => {
			if (i) length += Math.hypot(p.x - raw[i - 1].x, p.y - raw[i - 1].y);
			return { ...p, tx: 1, ty: 0, s: length, u: 0 };
		});
		for (let i = 0; i < points.length; i++) {
			const before = raw[i > 0 ? i - 1 : closed && raw.length > 2 ? raw.length - 2 : 0];
			const after = raw[i < raw.length - 1 ? i + 1 : closed && raw.length > 1 ? 1 : i];
			const dx = after.x - before.x,
				dy = after.y - before.y,
				n = Math.hypot(dx, dy);
			points[i].tx = n > 1e-9 ? dx / n : 1;
			points[i].ty = n > 1e-9 ? dy / n : 0;
			points[i].u = length ? points[i].s / length : 0;
		}
		contours.push({ points, closed, length });
		raw = [];
		closed = false;
	};
	const line = (ex: number, ey: number) => {
		const n = Math.max(1, Math.ceil(Math.hypot(ex - x, ey - y) / maxStep));
		const ax = x,
			ay = y;
		for (let i = 1; i <= n; i++) append(ax + ((ex - ax) * i) / n, ay + ((ey - ay) * i) / n);
		x = ex;
		y = ey;
	};
	for (const command of geometry.commands) {
		const v = command.values;
		if (command.op === "M") {
			finish();
			x = v[0];
			y = v[1];
			sx = x;
			sy = y;
			append(x, y);
		} else if (command.op === "L") line(v[0], v[1]);
		else if (command.op === "Z") {
			line(sx, sy);
			closed = true;
		} else if (command.op === "A") {
			const a = arc(x, y, v);
			if (!a) line(v[5], v[6]);
			else {
				const r = Math.max(a.rx, a.ry);
				const delta = 2 * Math.acos(Math.max(-1, 1 - Math.min(precision / r, 1)));
				const n = Math.max(
					1,
					Math.ceil(Math.abs(a.sweep) / Math.max(delta, 1e-6)),
					Math.ceil((r * Math.abs(a.sweep)) / maxStep),
				);
				const c = Math.cos(a.phi),
					s = Math.sin(a.phi);
				for (let i = 1; i <= n; i++) {
					const angle = a.start + (a.sweep * i) / n;
					const ax = a.rx * Math.cos(angle),
						ay = a.ry * Math.sin(angle);
					append(a.cx + c * ax - s * ay, a.cy + s * ax + c * ay);
				}
				x = v[5];
				y = v[6];
			}
		} else {
			const cubic = command.op === "C";
			const ex = v[cubic ? 4 : 2],
				ey = v[cubic ? 5 : 3];
			const bx = cubic ? v[0] : x + (2 * (v[0] - x)) / 3,
				by = cubic ? v[1] : y + (2 * (v[1] - y)) / 3;
			const cx = cubic ? v[2] : ex + (2 * (v[0] - ex)) / 3,
				cy = cubic ? v[3] : ey + (2 * (v[1] - ey)) / 3;
			const stack = [[x, y, bx, by, cx, cy, ex, ey, 0]];
			while (stack.length) {
				const p = stack.pop();
				if (!p) break;
				if (
					Math.max(
						distance(p[2], p[3], p[0], p[1], p[6], p[7]),
						distance(p[4], p[5], p[0], p[1], p[6], p[7]),
					) <= precision &&
					Math.hypot(p[6] - p[0], p[7] - p[1]) <= maxStep
				)
					append(p[6], p[7]);
				else {
					if (p[8] >= 24) throw new RangeError("曲线细分超过原型深度预算；未降低精度");
					const ax = (p[0] + p[2]) / 2,
						ay = (p[1] + p[3]) / 2,
						bx = (p[2] + p[4]) / 2,
						by = (p[3] + p[5]) / 2,
						cx = (p[4] + p[6]) / 2,
						cy = (p[5] + p[7]) / 2;
					const dx = (ax + bx) / 2,
						dy = (ay + by) / 2,
						ex = (bx + cx) / 2,
						ey = (by + cy) / 2,
						mx = (dx + ex) / 2,
						my = (dy + ey) / 2;
					stack.push(
						[mx, my, ex, ey, cx, cy, p[6], p[7], p[8] + 1],
						[p[0], p[1], ax, ay, dx, dy, mx, my, p[8] + 1],
					);
				}
			}
			x = ex;
			y = ey;
		}
	}
	finish();
	const entries = cache ?? new Map<string, readonly Contour[]>();
	if (entries.size >= 4) {
		const first = entries.keys().next().value;
		if (first !== undefined) entries.delete(first);
	}
	entries.set(key, contours);
	sampled.set(geometry, entries);
	return contours;
}
