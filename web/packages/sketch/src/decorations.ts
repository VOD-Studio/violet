import { geometryFromCommands, sampleGeometry } from "./geometry.ts";
import type { Geometry } from "./types.ts";

/**
 * 在未扰动骨架的末端生成实心三角箭头。
 *
 * @param geometry - 不含 Z 的开放骨架；末端须具有可用方向
 * @param size - 场景单位的箭头长度，缺省为 12，底边宽度为其 0.84 倍；应为有限正数但不校验
 * @remarks 直线与贝塞尔使用末端方向，圆弧通过整条几何的最后轮廓采样近似方向；
 * 采样固定步长 0.5、容差 0.05，未接入调用方共享预算。
 * @throws {@link RangeError} 当路径含 Z、末端方向长度为零或圆弧采样达到几何限制。
 */
export function arrowForPath(geometry: Geometry, size = 12): Geometry {
	let x = 0,
		y = 0,
		tx = 0,
		ty = 0;
	for (const command of geometry.commands) {
		const v = command.values;
		if (command.op === "M") {
			x = v[0];
			y = v[1];
			tx = 0;
			ty = 0;
		} else if (command.op === "L") {
			tx = v[0] - x;
			ty = v[1] - y;
			x = v[0];
			y = v[1];
		} else if (command.op === "Q") {
			tx = v[2] - v[0];
			ty = v[3] - v[1];
			if (Math.hypot(tx, ty) === 0) {
				tx = v[2] - x;
				ty = v[3] - y;
			}
			x = v[2];
			y = v[3];
		} else if (command.op === "C") {
			tx = v[4] - v[2];
			ty = v[5] - v[3];
			if (Math.hypot(tx, ty) === 0) {
				tx = v[4] - v[0];
				ty = v[5] - v[1];
			}
			if (Math.hypot(tx, ty) === 0) {
				tx = v[4] - x;
				ty = v[5] - y;
			}
			x = v[4];
			y = v[5];
		} else if (command.op === "A") {
			const contours = sampleGeometry(geometry, 0.5, 0.05);
			const last = contours[contours.length - 1]?.points;
			if (last && last.length > 1) {
				tx = last[last.length - 1].x - last[last.length - 2].x;
				ty = last[last.length - 1].y - last[last.length - 2].y;
			}
			x = v[5];
			y = v[6];
		} else throw new RangeError("Closed skeletons do not have a terminal arrow anchor");
	}
	const length = Math.hypot(tx, ty);
	if (!length) throw new RangeError("A zero-length endpoint has no arrow direction");
	const ux = tx / length,
		uy = ty / length;
	return geometryFromCommands([
		{ op: "M", values: [x, y] },
		{ op: "L", values: [x - size * ux - size * 0.42 * uy, y - size * uy + size * 0.42 * ux] },
		{ op: "L", values: [x - size * ux + size * 0.42 * uy, y - size * uy - size * 0.42 * ux] },
		{ op: "Z", values: [] },
	]);
}

/**
 * 从指定场景坐标生成上下交替的二次贝塞尔波浪线。
 *
 * @param width - 场景单位的水平跨度，按每段至多 30 单位划分，应为有限非负数但不校验
 * @param amplitude - 控制点相对基线的场景单位偏移，实际峰值为其一半；缺省为 4，零值生成直线
 * @remarks 至少生成一段曲线；宽度为零时也保留退化路径，末端始终位于基线。
 */
export function waveGeometry(x: number, y: number, width: number, amplitude = 4): Geometry {
	const commands: { op: "M" | "Q"; values: number[] }[] = [{ op: "M", values: [x, y] }];
	const count = Math.max(1, Math.ceil(width / 30));
	for (let i = 0; i < count; i++) {
		const a = x + (width * i) / count,
			b = x + (width * (i + 1)) / count;
		commands.push({
			op: "Q",
			values: [(a + b) / 2, y + (i % 2 ? -amplitude : amplitude), b, y],
		});
	}
	return geometryFromCommands(commands);
}
