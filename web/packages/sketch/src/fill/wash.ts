import { polylineContour } from "../core/flatten.ts";
import { PathBuilder, transformPath } from "../core/path.ts";
import { channel } from "../core/rng.ts";
import type { Contour, Fill } from "../core/types.ts";
import { scanSpans } from "./scan.ts";

const SHIFT = /* @__PURE__ */ channel("sketch:wash:shift");
const EDGE = /* @__PURE__ */ channel("sketch:wash:edge");
const PATCH = /* @__PURE__ */ channel("sketch:wash:patch");
const TRIM = /* @__PURE__ */ channel("sketch:wash:trim");

/** 淡彩填充参数。 */
export interface WashOptions {
	/** 指向光源的方向向量，场景坐标（y 向下）；会被归一化。 @default [-0.55, -0.83] 光来自左上 */
	light?: readonly [number, number];
	/** 朝光一侧纸白留白的平均宽度，相对图形较短边的比例；0 表示色块贴满线稿。 @default 0.06 */
	highlight?: number;
	/** 色块边缘的起伏幅度，相对留白宽度的比例。 @default 0.9 */
	bleed?: number;
	/** 色块不透明度；小于 1 时前后图元互相透色。 @default 1 */
	opacity?: number;
	/** 背光侧排线带的宽度，相对较短边的比例；0 表示不画排线。 @default 0.16 */
	hatch?: number;
	/** 排线间距，单位为填充线宽。 @default 2.6 */
	hatchGap?: number;
	/** 排线角度，度。 @default 58 */
	hatchAngle?: number;
	/** 排线的颜色角色，与线稿同墨。 @default "ink" */
	hatchRole?: string;
}

/**
 * 创建淡彩填充：浅色平涂朝背光侧错位，朝光一侧露出宽窄不一的纸白，背光侧加成簇的墨色短排线。
 *
 * 色块边缘沿法向随噪声起伏并裁剪到原形状，留白宽度因此时宽时窄；排线是交给填充手法与填充笔描绘的骨架，
 * 只落在背光侧的条带内，按噪声成簇出现。
 *
 * @remarks 较短边小于 36 的图形不画排线。
 */
export function createWashFill(options: WashOptions = {}): Fill {
	const [lx, ly] = options.light ?? [-0.55, -0.83];
	const norm = Math.hypot(lx, ly) || 1;
	const ux = lx / norm;
	const uy = ly / norm;
	const highlight = options.highlight ?? 0.06;
	const bleed = options.bleed ?? 0.9;
	const hatch = options.hatch ?? 0.16;
	const angle = ((options.hatchAngle ?? 58) * Math.PI) / 180;
	return {
		id: "wash",
		generate(region, ctx, source) {
			if (!ctx.fillRole) return {};
			const size = Math.min(source.bounds.width, source.bounds.height);

			// 色块：整体朝背光侧平移 d，边缘沿法向起伏，裁剪后朝光侧留白在 (1 ± bleed)·d 之间变化。
			const d =
				Math.max(1.2, Math.min(7, size * highlight)) * (0.7 + 0.6 * ctx.random(SHIFT, 0));
			const amplitude = d * bleed;
			const wash = new PathBuilder();
			region.contours.forEach((contour, ci) => {
				const p = contour.points;
				const n = p.length / 2;
				if (!contour.closed || n < 3) return;
				const wavelength = Math.max(16, Math.min(70, contour.length / 6));
				const edge = EDGE ^ Math.imul(ci + 1, 0x9e3779b1);
				for (let i = 0; i < n; i++) {
					const prev = ((i - 1 + n) % n) * 2;
					const next = ((i + 1) % n) * 2;
					const tx = p[next] - p[prev];
					const ty = p[next + 1] - p[prev + 1];
					const length = Math.hypot(tx, ty) || 1;
					const offset = amplitude * ctx.noise(edge, contour.arc[i] / wavelength);
					const x = p[i * 2] - ux * d - (ty / length) * offset;
					const y = p[i * 2 + 1] - uy * d + (tx / length) * offset;
					if (i) wash.lineTo(x, y);
					else wash.moveTo(x, y);
				}
				wash.close();
			});
			const areas = [
				{ path: wash.build(region.fillRule), opacity: options.opacity, clip: true },
			];
			if (hatch <= 0 || size < 36) return { areas };

			// 排线：同一组扫描线分别切原形状与朝光源平移的副本，逐行相减剩下的区间即背光侧条带。
			const band = Math.max(4, Math.min(22, size * hatch));
			const toward = ctx.flatten(transformPath(source, [1, 0, 0, 1, ux * band, uy * band]));
			const gap = (options.hatchGap ?? 2.6) * ctx.width;
			const rowY = (row: number) => row * gap;
			const c = Math.cos(angle);
			const s = Math.sin(angle);
			const covered = new Map<number, number[]>();
			scanSpans(toward, angle, gap, rowY, (left, right, _y, row) => {
				const spans = covered.get(row);
				if (spans) spans.push(left, right);
				else covered.set(row, [left, right]);
			});
			const contours: Contour[] = [];
			const emit = (left: number, right: number, y: number, row: number) => {
				const span = right - left;
				if (span > band * 2.4 || span < ctx.width * 2) return;
				const a = left + span * 0.35 * ctx.random(TRIM, row);
				contours.push(
					polylineContour([
						c * a - s * y,
						s * a + c * y,
						c * right - s * y,
						s * right + c * y,
					]),
				);
			};
			scanSpans(region, angle, gap, rowY, (left, right, y, row) => {
				// 噪声成簇：只保留一部分行，排线一丛一丛出现而不是均匀铺满
				if (ctx.noise(PATCH, row * 0.3) < 0.12) return;
				const spans = covered.get(row) ?? [];
				let from = left;
				// 同一行的区间按 x 升序回调
				for (let i = 0; i < spans.length && spans[i] < right; i += 2) {
					if (spans[i + 1] <= from) continue;
					if (spans[i] > from) emit(from, spans[i], y, row);
					from = Math.max(from, spans[i + 1]);
				}
				if (from < right) emit(from, right, y, row);
			});
			if (!contours.length) return { areas };
			return {
				areas,
				guides: { contours, fillRule: "nonzero" },
				guideRole: options.hatchRole ?? "ink",
			};
		},
	};
}
