import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeaderContributionHeatmap } from "../HeaderContributionHeatmap";

const WEEKS_SHOWN = 13;

function renderHeatmap(contributions: Array<{ date: string; count: number }> = []) {
	return render(
		<HeaderContributionHeatmap
			githubUsername="xunrua"
			contributions={contributions}
			totalContributions={0}
		/>,
	);
}

/** 返回 13 列 × 7 格的热力矩阵 DOM。 */
function getColumns(container: HTMLElement) {
	const grid = container.querySelector('div[role="img"]');
	expect(grid).not.toBeNull();
	const columns = Array.from(grid?.children ?? []);
	expect(columns).toHaveLength(WEEKS_SHOWN);
	return columns.map((column) => Array.from(column.children) as HTMLElement[]);
}

afterEach(() => {
	vi.useRealTimers();
});

describe("HeaderContributionHeatmap", () => {
	it("列对齐自然周：每列 7 格，首列与末列的列首都是周日", () => {
		vi.setSystemTime(new Date(2026, 8, 8, 12)); // 2026-09-08 周二
		const { container } = renderHeatmap([
			{ date: "2026-06-14", count: 12 }, // 窗口首日（周日）
			{ date: "2026-09-06", count: 12 }, // 本周日
		]);
		const columns = getColumns(container);
		for (const cells of columns) {
			expect(cells).toHaveLength(7);
		}
		// 两个周日都应落在各自列的第 0 格并染最高档
		expect(columns[0][0].className).toContain("bg-primary");
		expect(columns.at(-1)?.[0].className).toContain("bg-primary");
	});

	it("今天落在末列真实星期位置，之后的格位为空占位", () => {
		vi.setSystemTime(new Date(2026, 8, 8, 12)); // 周二 → 末列第 3 格
		const { container } = renderHeatmap();
		const columns = getColumns(container);
		const ringed = columns.flat().filter((cell) => cell.className.includes("ring-primary"));
		expect(ringed).toHaveLength(1);
		expect(columns.at(-1)?.indexOf(ringed[0])).toBe(2);

		// 周三~周六共 4 格空占位：无热力色、无 hover 交互
		const placeholder = (cell: HTMLElement) => !cell.className.includes("hover:ring");
		expect(columns.at(-1)?.filter(placeholder)).toHaveLength(4);
		expect(columns.slice(0, -1).flat().filter(placeholder)).toHaveLength(0);
	});

	it("月份刻度按自然周边界落位", () => {
		vi.setSystemTime(new Date(2026, 8, 12)); // 周六，窗口 2026-06-14 ~ 09-12 无未来占位
		const { container } = renderHeatmap();
		const tickRow = container.querySelector('div[aria-hidden="true"]');
		expect(tickRow).not.toBeNull();
		const ticks = Array.from(tickRow?.querySelectorAll("span") ?? []).map(
			(span) => span.textContent ?? "",
		);
		expect(ticks).toHaveLength(WEEKS_SHOWN);
		expect(ticks.map((text) => text.trim()).filter(Boolean)).toEqual(["7月", "8月", "9月"]);
	});
});
