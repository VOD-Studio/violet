import { describe, expect, it } from "vitest";
import { justifyRows } from "../justify-layout";

/** 方形项生成器：n 个 1:1 项 */
const squares = (n: number) => Array.from({ length: n }, () => ({ width: 100, height: 100 }));

describe("justifyRows — 等高行分行", () => {
	it("空输入或零宽容器返回空行", () => {
		expect(justifyRows([], 800, 240)).toEqual([]);
		expect(justifyRows(squares(3), 0, 240)).toEqual([]);
	});

	it("单项成行且保持目标行高（末行不拉伸）", () => {
		const rows = justifyRows([{ width: 200, height: 100 }], 800, 240);
		expect(rows).toHaveLength(1);
		expect(rows[0].h).toBe(240);
		expect(rows[0].cells[0].w).toBe(480); // 2:1 比例 × 行高
	});

	it("饱和封行：行内比例和达到容器宽/目标高即切行，行高铺满容器宽", () => {
		// 容器 800 / 目标高 200 → 饱和线 4.0；两个 2:1 项（比例和 4.0）应同行铺满
		const rows = justifyRows(
			[
				{ width: 200, height: 100 },
				{ width: 200, height: 100 },
			],
			800,
			200,
		);
		expect(rows).toHaveLength(1);
		// (800-gap)/比例和4 → 行高 198
		expect(rows[0].h).toBeCloseTo(198, 5);
		const totalW = rows[0].cells.reduce((s, c) => s + c.w, 0) + 8;
		expect(totalW).toBeCloseTo(800, 5);
	});

	it("超饱和切到下一行", () => {
		// 三个 2:1 项比例和 6 > 4：前两项封行，第三项落末行按目标高渲染
		const rows = justifyRows(
			[
				{ width: 200, height: 100 },
				{ width: 200, height: 100 },
				{ width: 200, height: 100 },
			],
			800,
			200,
		);
		expect(rows).toHaveLength(2);
		expect(rows[1].cells).toHaveLength(1);
		expect(rows[1].h).toBe(200);
	});

	it("尺寸未知项按 1:1 兜底参与分行", () => {
		const rows = justifyRows(
			[
				{ width: null, height: null },
				{ width: 0, height: 0 },
			],
			800,
			200,
		);
		// 两个 1:1 比例和 2 < 4（饱和线），同一末行，行高保持目标值
		expect(rows).toHaveLength(1);
		expect(rows[0].cells.map((c) => c.index)).toEqual([0, 1]);
		expect(rows[0].h).toBe(200);
	});

	it("末行加 gap 溢出时回缩铺满而非换行溢出", () => {
		// 饱和线 4：一个 3.9:1 项 + 一个 0.2:1 项，比例和 4.1 ≥ 4 封行铺满
		const rows = justifyRows(
			[
				{ width: 390, height: 100 },
				{ width: 20, height: 100 },
			],
			800,
			200,
		);
		expect(rows).toHaveLength(1);
		const totalW = rows[0].cells.reduce((s, c) => s + c.w, 0) + 8;
		expect(totalW).toBeCloseTo(800, 5);
	});

	it("index 回指源数组顺序", () => {
		const rows = justifyRows(squares(6), 800, 400);
		const seen = rows.flatMap((r) => r.cells.map((c) => c.index));
		expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
	});
});
