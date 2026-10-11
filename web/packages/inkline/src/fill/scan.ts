import type { Skeleton } from "../core/types.ts";

interface Edge {
	minY: number;
	maxY: number;
	x: number;
	slope: number;
	winding: number;
}

interface Crossing {
	x: number;
	winding: number;
}

const MAX_ROWS = 100_000;

/**
 * 以给定角度的平行扫描线与区域求交，按填充规则回调每个内部区间。
 *
 * @param angle - 扫描线方向，弧度；回调中的 left/right/y 位于旋转后的坐标系
 * @param rowY - 第 row 条扫描线在旋转坐标系中的 y；须随 row 严格递增
 * @throws {@link RangeError} 当扫描超过 100000 行。
 * @remarks 开放子路径与 SVG 填充一致，按首尾相连参与区域判定。
 */
export function scanSpans(
	region: Skeleton,
	angle: number,
	gap: number,
	rowY: (row: number) => number,
	visit: (left: number, right: number, y: number, row: number) => void,
): void {
	const c = Math.cos(angle);
	const s = Math.sin(angle);
	const edges: Edge[] = [];
	for (const contour of region.contours) {
		const p = contour.points;
		const n = p.length / 2;
		for (let i = 0; i < n; i++) {
			const j = (i + 1) % n;
			const ax = c * p[i * 2] + s * p[i * 2 + 1];
			const ay = -s * p[i * 2] + c * p[i * 2 + 1];
			const bx = c * p[j * 2] + s * p[j * 2 + 1];
			const by = -s * p[j * 2] + c * p[j * 2 + 1];
			if (Math.abs(by - ay) < 1e-10) continue;
			edges.push({
				minY: Math.min(ay, by),
				maxY: Math.max(ay, by),
				x: ay < by ? ax : bx,
				slope: (bx - ax) / (by - ay),
				winding: by > ay ? 1 : -1,
			});
		}
	}
	if (!edges.length) return;
	edges.sort((a, b) => a.minY - b.minY);
	let next = 0;
	let row = Math.floor(edges[0].minY / gap);
	let scanned = 0;
	let active: Edge[] = [];
	const crossings: Crossing[] = [];
	while (next < edges.length || active.length) {
		const y = rowY(row);
		if (!active.length && next < edges.length && edges[next].minY > y) {
			row = Math.max(row + 1, Math.floor(edges[next].minY / gap) - 1);
			continue;
		}
		if (++scanned > MAX_ROWS) throw new RangeError("填充超过 100000 条扫描线；未降低密度");
		// 半开区间让共享顶点只计一次。
		active = active.filter((edge) => edge.maxY > y);
		while (next < edges.length && edges[next].minY <= y) {
			const edge = edges[next++];
			if (edge.maxY > y) active.push(edge);
		}
		crossings.length = 0;
		for (const edge of active)
			crossings.push({ x: edge.x + (y - edge.minY) * edge.slope, winding: edge.winding });
		crossings.sort((a, b) => a.x - b.x);
		let winding = 0;
		let parity = 0;
		let left = 0;
		for (let i = 0; i < crossings.length; ) {
			const x = crossings[i].x;
			const wasInside = region.fillRule === "evenodd" ? parity !== 0 : winding !== 0;
			let delta = 0;
			let count = 0;
			// 重合交点合并计数，避免虚假的内部区间。
			while (i < crossings.length && Math.abs(crossings[i].x - x) < 1e-9) {
				delta += crossings[i++].winding;
				count++;
			}
			winding += delta;
			parity = (parity + count) % 2;
			const isInside = region.fillRule === "evenodd" ? parity !== 0 : winding !== 0;
			if (!wasInside && isInside) left = x;
			else if (wasInside && !isInside && x - left > 1e-9) visit(left, x, y, row);
		}
		row++;
	}
}
