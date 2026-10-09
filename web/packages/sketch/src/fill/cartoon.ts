import { LIGHT, SHADE } from "../core/color.ts";
import { mergePaths, transformPath } from "../core/path.ts";
import { channel } from "../core/rng.ts";
import type { Area, Fill, Path } from "../core/types.ts";

const MISREG = /* @__PURE__ */ channel("sketch:cartoon:misregister");

/** 卡通填充参数。 */
export interface CartoonOptions {
	/** 指向光源的方向向量，场景坐标（y 向下）；会被归一化。 @default [-0.55, -0.83] 光来自左上 */
	light?: readonly [number, number];
	/** 阴影宽度相对图形较短边的比例。 @default 0.16 */
	shadow?: number;
	/** 是否绘制高光。 @default true */
	highlight?: boolean;
	/** 平涂相对线稿的错位幅度，场景单位；0 表示严格对齐。 @default 1.2 */
	misregistration?: number;
}

/** 以 evenodd 合并两份形状：只被其一覆盖的部分被填充，调用方再用原路径裁剪。 */
const crescent = (a: Path, b: Path): Path => mergePaths([a, b], "evenodd");

/**
 * 创建赛璐璐式填充：平涂底色、硬边阴影与高光。
 *
 * 阴影是原形状与朝光源平移后的副本之差，高光是内缩形状与朝背光平移后副本之差，都由图形几何推导，不用固定模板；
 * 颜色取 `角色:shade` 与 `角色:light`，由 {@link import("../core/color.ts").cartoonPalette} 派生。
 *
 * @remarks 较短边小于 14 的图形只上底色，小于 30 的图形没有高光。
 */
export function createCartoonFill(options: CartoonOptions = {}): Fill {
	const [lx, ly] = options.light ?? [-0.55, -0.83];
	const norm = Math.hypot(lx, ly) || 1;
	const ux = lx / norm;
	const uy = ly / norm;
	const depth = options.shadow ?? 0.16;
	const mis = options.misregistration ?? 1.2;
	return {
		id: "cartoon",
		generate(_region, ctx, source) {
			const role = ctx.fillRole;
			if (!role) return {};
			const { x, y, width, height } = source.bounds;
			const size = Math.min(width, height);
			const dx = (ctx.random(MISREG, 0) * 2 - 1) * mis;
			const dy = (ctx.random(MISREG, 1) * 2 - 1) * mis;
			const areas: Area[] = [{ path: transformPath(source, [1, 0, 0, 1, dx, dy]), role }];
			if (size >= 14) {
				const d = Math.max(3, Math.min(28, size * depth));
				const toward = transformPath(source, [1, 0, 0, 1, ux * d, uy * d]);
				areas.push({ path: crescent(source, toward), role: role + SHADE, clip: true });
			}
			if (size >= 30 && options.highlight !== false) {
				const cx = x + width / 2;
				const cy = y + height / 2;
				const s = 0.8;
				const lift = size * 0.05;
				const inset = transformPath(source, [
					s,
					0,
					0,
					s,
					cx * (1 - s) + ux * lift,
					cy * (1 - s) + uy * lift,
				]);
				const d = Math.max(2, Math.min(10, size * 0.07));
				const away = transformPath(inset, [1, 0, 0, 1, -ux * d, -uy * d]);
				areas.push({ path: crescent(inset, away), role: role + LIGHT, clip: inset });
			}
			return { areas };
		},
	};
}
