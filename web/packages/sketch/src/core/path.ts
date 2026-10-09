import { absolutize, normalize, parsePath } from "path-data-parser";
import { CLOSE, CUBIC, LINE, MOVE, type Path } from "./types.ts";

// 四分之一圆的三次贝塞尔控制柄比例。
const KAPPA = 0.5522847498307936;

/** 逐段构造 {@link Path}；坐标为场景单位的绝对值。 */
export class PathBuilder {
	private verbs: number[] = [];
	private coords: number[] = [];

	moveTo(x: number, y: number): this {
		this.verbs.push(MOVE);
		this.coords.push(x, y);
		return this;
	}

	lineTo(x: number, y: number): this {
		this.verbs.push(LINE);
		this.coords.push(x, y);
		return this;
	}

	cubicTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number): this {
		this.verbs.push(CUBIC);
		this.coords.push(x1, y1, x2, y2, x, y);
		return this;
	}

	/** 二次曲线按升阶公式转为等价三次曲线。 */
	quadTo(x1: number, y1: number, x: number, y: number): this {
		const n = this.coords.length;
		const x0 = this.coords[n - 2] ?? 0;
		const y0 = this.coords[n - 1] ?? 0;
		return this.cubicTo(
			x0 + ((x1 - x0) * 2) / 3,
			y0 + ((y1 - y0) * 2) / 3,
			x + ((x1 - x) * 2) / 3,
			y + ((y1 - y) * 2) / 3,
			x,
			y,
		);
	}

	close(): this {
		this.verbs.push(CLOSE);
		return this;
	}

	build(fillRule: Path["fillRule"] = "nonzero"): Path {
		return createPath(Uint8Array.from(this.verbs), Float64Array.from(this.coords), fillRule);
	}
}

/** 由动词与坐标数组构造路径，并计算保守包围盒。 */
export function createPath(
	verbs: Uint8Array,
	coords: Float64Array,
	fillRule: Path["fillRule"] = "nonzero",
): Path {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (let i = 0; i < coords.length; i += 2) {
		const x = coords[i];
		const y = coords[i + 1];
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
	}
	const empty = !Number.isFinite(minX);
	return {
		verbs,
		coords,
		fillRule,
		bounds: {
			x: empty ? 0 : minX,
			y: empty ? 0 : minY,
			width: empty ? 0 : maxX - minX,
			height: empty ? 0 : maxY - minY,
		},
	};
}

/**
 * 解析 SVG path 字符串；相对、平滑、二次与圆弧命令均转换为绝对 M/L/C/Z。
 *
 * @throws 解析器对无效路径抛出的错误直接传播。
 */
export function pathFromSvg(d: string, fillRule: Path["fillRule"] = "nonzero"): Path {
	const builder = new PathBuilder();
	for (const { key, data } of normalize(absolutize(parsePath(d)))) {
		if (key === "M") builder.moveTo(data[0], data[1]);
		else if (key === "L") builder.lineTo(data[0], data[1]);
		else if (key === "C") builder.cubicTo(data[0], data[1], data[2], data[3], data[4], data[5]);
		else if (key === "Z") builder.close();
	}
	return builder.build(fillRule);
}

/** 两点直线。 */
export function line(x1: number, y1: number, x2: number, y2: number): Path {
	return new PathBuilder().moveTo(x1, y1).lineTo(x2, y2).build();
}

/** 按顺序连接各点；closed 为 true 时闭合。 */
export function polyline(points: readonly (readonly [number, number])[], closed = false): Path {
	const builder = new PathBuilder();
	points.forEach(([x, y], i) => {
		if (i) builder.lineTo(x, y);
		else builder.moveTo(x, y);
	});
	if (closed && points.length) builder.close();
	return builder.build();
}

/** 闭合多边形。 */
export function polygon(points: readonly (readonly [number, number])[]): Path {
	return polyline(points, true);
}

/**
 * 矩形；radius 大于 0 时为圆角矩形。
 *
 * @param radius - 圆角半径，钳制到较短边的一半以内
 */
export function rect(x: number, y: number, w: number, h: number, radius = 0): Path {
	const r = Math.max(0, Math.min(radius, w / 2, h / 2));
	const builder = new PathBuilder();
	if (!r)
		return builder
			.moveTo(x, y)
			.lineTo(x + w, y)
			.lineTo(x + w, y + h)
			.lineTo(x, y + h)
			.close()
			.build();
	const k = r * (1 - KAPPA);
	return builder
		.moveTo(x + r, y)
		.lineTo(x + w - r, y)
		.cubicTo(x + w - k, y, x + w, y + k, x + w, y + r)
		.lineTo(x + w, y + h - r)
		.cubicTo(x + w, y + h - k, x + w - k, y + h, x + w - r, y + h)
		.lineTo(x + r, y + h)
		.cubicTo(x + k, y + h, x, y + h - k, x, y + h - r)
		.lineTo(x, y + r)
		.cubicTo(x, y + k, x + k, y, x + r, y)
		.close()
		.build();
}

/** 以 (cx, cy) 为中心的椭圆，由四段三次贝塞尔构成。 */
export function ellipse(cx: number, cy: number, rx: number, ry: number): Path {
	const kx = rx * KAPPA;
	const ky = ry * KAPPA;
	return new PathBuilder()
		.moveTo(cx + rx, cy)
		.cubicTo(cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry)
		.cubicTo(cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy)
		.cubicTo(cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry)
		.cubicTo(cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy)
		.close()
		.build();
}

/** 圆。 */
export function circle(cx: number, cy: number, r: number): Path {
	return ellipse(cx, cy, r, r);
}

/**
 * 椭圆弧，从 start 到 end 弧度沿正角方向；每段不超过 90°。
 *
 * @param closed - none 为开放弧；chord 连接两端；pie 经过圆心
 */
export function arc(
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	start: number,
	end: number,
	closed: "none" | "chord" | "pie" = "none",
): Path {
	const sweep = Math.min(Math.abs(end - start), Math.PI * 2) * Math.sign(end - start || 1);
	const segments = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
	const step = sweep / segments;
	const h = (4 / 3) * Math.tan(step / 4);
	const builder = new PathBuilder();
	const px = (a: number) => cx + rx * Math.cos(a);
	const py = (a: number) => cy + ry * Math.sin(a);
	if (closed === "pie") builder.moveTo(cx, cy).lineTo(px(start), py(start));
	else builder.moveTo(px(start), py(start));
	for (let i = 0; i < segments; i++) {
		const a0 = start + step * i;
		const a1 = a0 + step;
		builder.cubicTo(
			px(a0) - h * rx * Math.sin(a0),
			py(a0) + h * ry * Math.cos(a0),
			px(a1) + h * rx * Math.sin(a1),
			py(a1) - h * ry * Math.cos(a1),
			px(a1),
			py(a1),
		);
	}
	if (closed !== "none") builder.close();
	return builder.build();
}

/**
 * 穿过各点的平滑曲线，使用向心 Catmull-Rom 插值。
 */
export function curve(points: readonly (readonly [number, number])[]): Path {
	const builder = new PathBuilder();
	if (!points.length) return builder.build();
	builder.moveTo(points[0][0], points[0][1]);
	const flat: number[] = [];
	for (const [x, y] of points) flat.push(x, y);
	catmullRomToCubics(flat, 2, (c) => builder.cubicTo(c[0], c[1], c[2], c[3], c[4], c[5]));
	return builder.build();
}

const control = new Float64Array(6);

/**
 * 把控制点序列按向心 Catmull-Rom（α = 0.5）转换为首尾相接的三次贝塞尔段。
 *
 * @param values - 交错存放的点数据，每点 stride 个分量，前两个为 x、y
 * @param emit - 每段回调一次；参数数组被复用，回调内须立即读取
 * @remarks 首尾用镜像幻点补齐；少于两点时不输出。
 */
export function catmullRomToCubics(
	values: ArrayLike<number>,
	stride: number,
	emit: (cubic: Float64Array, segment: number) => void,
): void {
	const n = Math.floor(values.length / stride);
	if (n < 2) return;
	const x = (i: number) => values[i * stride];
	const y = (i: number) => values[i * stride + 1];
	for (let i = 0; i < n - 1; i++) {
		const x1 = x(i);
		const y1 = y(i);
		const x2 = x(i + 1);
		const y2 = y(i + 1);
		const x0 = i > 0 ? x(i - 1) : 2 * x1 - x2;
		const y0 = i > 0 ? y(i - 1) : 2 * y1 - y2;
		const x3 = i + 2 < n ? x(i + 2) : 2 * x2 - x1;
		const y3 = i + 2 < n ? y(i + 2) : 2 * y2 - y1;
		// 向心参数化：d = |Δ|^0.5，d² = |Δ|。
		const s1 = Math.max(Math.hypot(x1 - x0, y1 - y0), 1e-9);
		const s2 = Math.max(Math.hypot(x2 - x1, y2 - y1), 1e-9);
		const s3 = Math.max(Math.hypot(x3 - x2, y3 - y2), 1e-9);
		const d1 = Math.sqrt(s1);
		const d2 = Math.sqrt(s2);
		const d3 = Math.sqrt(s3);
		const a = 2 * s1 + 3 * d1 * d2 + s2;
		const b = 3 * d1 * (d1 + d2);
		const c = 2 * s3 + 3 * d3 * d2 + s2;
		const d = 3 * d3 * (d3 + d2);
		control[0] = (s1 * x2 - s2 * x0 + a * x1) / b;
		control[1] = (s1 * y2 - s2 * y0 + a * y1) / b;
		control[2] = (s3 * x1 - s2 * x3 + c * x2) / d;
		control[3] = (s3 * y1 - s2 * y3 + c * y2) / d;
		control[4] = x2;
		control[5] = y2;
		emit(control, i);
	}
}
