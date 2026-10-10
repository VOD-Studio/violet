/**
 * Douglas–Peucker（1973）折线精简：首尾必留，区间内偏差超过容差时保留偏差最大的点并二分。
 * 多条等长折线按同一组下标精简，偏差取各条中的较大者，用于条带左右两侧同去同留。
 *
 * @param lines - 交错坐标 [x0, y0, x1, y1, …]，各条点数相同
 * @returns 升序的保留下标
 */
export function simplifyIndices(lines: readonly ArrayLike<number>[], tolerance: number): number[] {
	const n = lines[0].length / 2;
	if (n <= 2) return n === 2 ? [0, 1] : n === 1 ? [0] : [];
	const limit = tolerance * tolerance;
	const keep = new Uint8Array(n);
	keep[0] = 1;
	keep[n - 1] = 1;
	const stack = [0, n - 1];
	while (stack.length) {
		const b = stack.pop() as number;
		const a = stack.pop() as number;
		let worst = limit;
		let index = -1;
		for (const xy of lines) {
			const ax = xy[a * 2];
			const ay = xy[a * 2 + 1];
			const dx = xy[b * 2] - ax;
			const dy = xy[b * 2 + 1] - ay;
			const len2 = dx * dx + dy * dy;
			for (let i = a + 1; i < b; i++) {
				const px = xy[i * 2] - ax;
				const py = xy[i * 2 + 1] - ay;
				// 到线段（而非直线）的平方距离；首尾重合时即到该点的距离
				const t = len2 > 0 ? Math.max(0, Math.min(1, (px * dx + py * dy) / len2)) : 0;
				const ex = px - t * dx;
				const ey = py - t * dy;
				const d = ex * ex + ey * ey;
				if (d > worst) {
					worst = d;
					index = i;
				}
			}
		}
		if (index >= 0) {
			keep[index] = 1;
			stack.push(a, index, index, b);
		}
	}
	const kept: number[] = [];
	for (let i = 0; i < n; i++) if (keep[i]) kept.push(i);
	return kept;
}
