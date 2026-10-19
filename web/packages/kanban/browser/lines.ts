import type { Page } from "@playwright/test";

export interface Point {
	x: number;
	y: number;
}

/** 一条线在屏幕上的两个端点（路径在 SVG 用户坐标里，经 CTM 换成屏幕坐标，所以包含画布的缩放平移与滚动）。 */
export const endpoints = (page: Page, source: string, target: string) =>
	page.evaluate(
		({ source: from, target: to }) => {
			const group = document.querySelector(
				`.v-kanban__relation[data-source="${from}"][data-target="${to}"]`,
			);
			const path = group?.querySelector(
				"path.v-kanban__relation-line",
			) as SVGPathElement | null;
			if (!path) throw new Error("no such relation");
			const matrix = path.getScreenCTM() as DOMMatrix;
			const at = (offset: number): { x: number; y: number } => {
				const point = path.getPointAtLength(offset);
				const mapped = new DOMPoint(point.x, point.y).matrixTransform(matrix);
				return { x: mapped.x, y: mapped.y };
			};
			return { start: at(0), end: at(path.getTotalLength()) };
		},
		{ source, target },
	);

export const box = async (page: Page, selector: string) => {
	const rect = await page.locator(selector).boundingBox();
	if (!rect) throw new Error(`${selector} is not visible`);
	return rect;
};
export const near = (a: Point, b: Point, tolerance = 1.5) =>
	Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
export const rightMiddle = (rect: { x: number; y: number; width: number; height: number }) => ({
	x: rect.x + rect.width,
	y: rect.y + rect.height / 2,
});
export const leftMiddle = (rect: { x: number; y: number; width: number; height: number }) => ({
	x: rect.x,
	y: rect.y + rect.height / 2,
});
export type Rect = { x: number; y: number; width: number; height: number };

/** 线在两张卡片上各用哪一侧：目标在右用「右出左进」，在左用「左出右进」，水平方向重叠（同一列）都用右侧。 */
export function sides(from: Rect, to: Rect) {
	if (to.x >= from.x + from.width) return { start: rightMiddle(from), end: leftMiddle(to) };
	if (to.x + to.width <= from.x) return { start: leftMiddle(from), end: rightMiddle(to) };
	return { start: rightMiddle(from), end: rightMiddle(to) };
}
