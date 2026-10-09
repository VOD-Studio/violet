import { geometryFromCommands } from "../geometry.ts";
import type { Command, Geometry, Pen, PenContext } from "../types.ts";

/** 配置固定朝向的椭圆笔尖及沿轮廓变化的压力倍率。 */
export interface PressureOptions {
	/** 场景坐标系中的有限长轴角度，单位为度，非相对切线角；缺省为 -35。 */
	angle?: number;
	/** 短轴与长轴的有限比例，范围 (0, 1]；缺省为 0.48。 */
	aspect?: number;
	/**
	 * 以各轮廓近似弧长比例 u∈[0, 1] 返回有限非负线宽倍率，零值收尖。
	 * 缺省时开放轮廓自动收笔、闭合轮廓使用周期压力；自定义函数不追加收笔。
	 * 闭合轮廓须周期连续；实现仅按浮点容差检查两端值相等。零长度轮廓取 u=0.5。
	 */
	profile?: (u: number) => number;
}

interface Position {
	x: number;
	y: number;
}

interface NibSample extends Position {
	u: number;
	radius: number;
}

function turn(a: Position, b: Position, c: Position): number {
	return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function hull(points: Position[]): Position[] {
	points.sort((a, b) => a.x - b.x || a.y - b.y);
	const unique = points.filter(
		(p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y,
	);
	if (unique.length < 3) return unique;
	const lower: Position[] = [];
	const upper: Position[] = [];
	for (const point of unique) {
		while (
			lower.length > 1 &&
			turn(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
		)
			lower.pop();
		lower.push(point);
	}
	for (let i = unique.length - 1; i >= 0; i--) {
		const point = unique[i];
		while (
			upper.length > 1 &&
			turn(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
		)
			upper.pop();
		upper.push(point);
	}
	lower.pop();
	upper.pop();
	return lower.concat(upper);
}

function smoothstep(u: number): number {
	const t = Math.max(0, Math.min(1, u));
	return t * t * (3 - 2 * t);
}

function defaultPressure(u: number, closed: boolean): number {
	const body = 0.72 + 0.28 * Math.sin(Math.PI * 2 * u) ** 2;
	return closed ? body : body * smoothstep(u / 0.12) * smoothstep((1 - u) / 0.18);
}

/**
 * 将固定朝向的椭圆笔尖扫掠成 nonzero 复合填充。
 *
 * @returns 生成同绕向凸片 nonzero 填充的笔；压力全零时 generate 可返回空图层
 * @remarks 骨架、椭圆多边形及压力均经过近似；四分点压力探测可能漏过高频变化，不能保证任意回调或完整扫掠的全局误差。
 * profile 应为无副作用的确定性函数，每次求值均计入采样预算，回调异常直接传播。
 * @throws {@link RangeError} 当角度、轴比、宽度、精度或压力无效，闭合压力不匹配，坐标溢出，
 * 笔尖超过 4096 顶点或压力细分超过 12 层。
 * @throws 当共享预算耗尽时，传播 budget 抛出的错误，不自动降低精度。
 */
export function createPressurePen(options: PressureOptions = {}): Pen {
	const angle = options.angle ?? -35;
	const aspect = options.aspect ?? 0.48;
	const profile = options.profile;
	if (!Number.isFinite(angle) || !Number.isFinite(aspect) || aspect <= 0 || aspect > 1) {
		throw new RangeError("Pressure nib requires a finite angle and aspect in (0, 1]");
	}
	const radians = ((angle % 360) * Math.PI) / 180;
	const cosine = Math.cos(radians);
	const sine = Math.sin(radians);

	return {
		id: "pressure",
		generate(geometry: Geometry, context: PenContext) {
			if (
				!Number.isFinite(context.width) ||
				context.width <= 0 ||
				!Number.isFinite(context.precision) ||
				context.precision <= 0
			) {
				throw new RangeError(
					"Pressure generation requires positive finite width and precision",
				);
			}
			const commands: Command[] = [];
			const rings = new Map<number, readonly Position[]>();
			let maxRadius = 0;
			const contours = context.sample(geometry, 16);

			const emitSweep = (a: NibSample, b: NibSample) => {
				const radius = Math.max(a.radius, b.radius);
				if (radius === 0) return;
				maxRadius = Math.max(maxRadius, radius);
				// 此处仅控制笔尖多边形的弓高，不保证完整变宽扫掠的误差。
				const delta =
					2 * Math.acos(Math.max(-1, 1 - Math.min(context.precision / radius, 1)));
				const sides = Math.max(12, Math.ceil((Math.PI * 2) / delta));
				if (!Number.isFinite(sides) || sides > 4096) {
					throw new RangeError(
						"Pressure nib exceeds 4096 polygon vertices; precision was not relaxed",
					);
				}
				let ring = rings.get(sides);
				if (!ring) {
					const offsets: Position[] = [];
					for (let i = 0; i < sides; i++) {
						const theta = (Math.PI * 2 * i) / sides;
						const x = Math.cos(theta);
						const y = aspect * Math.sin(theta);
						offsets.push({ x: cosine * x - sine * y, y: sine * x + cosine * y });
					}
					ring = offsets;
					rings.set(sides, ring);
				}
				const endpoints: Position[] = [];
				for (const point of [a, b]) {
					if (point.radius === 0) endpoints.push({ x: point.x, y: point.y });
					else
						for (const offset of ring) {
							const x = point.x + offset.x * point.radius;
							const y = point.y + offset.y * point.radius;
							if (!Number.isFinite(x) || !Number.isFinite(y))
								throw new RangeError("Pressure nib coordinate overflow");
							endpoints.push({ x, y });
						}
				}
				const outline = hull(endpoints);
				if (outline.length < 3) return;
				context.budget.addCommands(outline.length + 1);
				for (let i = 0; i < outline.length; i++) {
					commands.push({
						op: i === 0 ? "M" : "L",
						values: [outline[i].x, outline[i].y],
					});
				}
				// 凸片保持同绕向，nonzero 填充使转角和折返处的重叠不会抵消。
				commands.push({ op: "Z", values: [] });
			};

			for (const contour of contours) {
				const pressureAt = (u: number): number => {
					context.budget.addSamples(1);
					const pressure = profile ? profile(u) : defaultPressure(u, contour.closed);
					const radius = (context.width * pressure) / 2;
					if (!Number.isFinite(pressure) || pressure < 0 || !Number.isFinite(radius)) {
						throw new RangeError(
							`Pressure profile must return a finite nonnegative multiplier at u=${u}`,
						);
					}
					return radius;
				};
				if (!contour.points.length) continue;
				if (contour.length === 0) {
					const point = contour.points[0];
					const dot = { x: point.x, y: point.y, u: 0.5, radius: pressureAt(0.5) };
					emitSweep(dot, dot);
					continue;
				}
				if (contour.closed && profile) {
					const start = pressureAt(0);
					const end = pressureAt(1);
					if (Math.abs(start - end) > Math.max(1e-9, Math.max(start, end) * 1e-9)) {
						throw new RangeError(
							"Closed contour pressure profile must have equal values at u=0 and u=1",
						);
					}
				}
				const refine = (a: NibSample, b: NibSample, depth: number) => {
					const probes = [0.25, 0.5, 0.75].map((t) => ({
						x: a.x + (b.x - a.x) * t,
						y: a.y + (b.y - a.y) * t,
						u: a.u + (b.u - a.u) * t,
						radius: pressureAt(a.u + (b.u - a.u) * t),
					}));
					const error = Math.max(
						...probes.map((p, i) =>
							Math.abs(p.radius - a.radius - ((b.radius - a.radius) * (i + 1)) / 4),
						),
					);
					if (error <= context.precision / 2) {
						emitSweep(a, b);
						return;
					}
					if (depth >= 12)
						throw new RangeError(
							"Pressure profile exceeded refinement depth 12; no geometry was truncated",
						);
					refine(a, probes[1], depth + 1);
					refine(probes[1], b, depth + 1);
				};
				const first = contour.points[0];
				let previous: NibSample = {
					x: first.x,
					y: first.y,
					u: first.u,
					radius: pressureAt(first.u),
				};
				for (let i = 1; i < contour.points.length; i++) {
					const point = contour.points[i];
					const next: NibSample = {
						x: point.x,
						y: point.y,
						u: point.u,
						radius: pressureAt(point.u),
					};
					refine(previous, next, 0);
					previous = next;
				}
			}
			if (!commands.length) return [];
			return [
				{
					geometry: geometryFromCommands(commands, "nonzero"),
					mode: "fill",
					role: context.strokeRole,
					reveal: geometry,
					revealWidth: maxRadius * 2 + context.precision * 2,
				},
			];
		},
	};
}
