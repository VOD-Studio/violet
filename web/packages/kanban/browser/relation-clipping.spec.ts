import { expect, type Page, test } from "@playwright/test";
import { box, endpoints, near, sides } from "./lines.ts";

const lineSelector =
	'.v-kanban__relation[data-source="a"][data-target="d"] .v-kanban__relation-line';

async function settle(page: Page) {
	await page.evaluate(() =>
		Promise.all(document.getAnimations().map((animation) => animation.finished)),
	);
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
			}),
	);
}

for (const side of ["left", "right"] as const) {
	test(`缩放后拖出看板${side === "left" ? "左" : "右"}侧，视口内的连接段保留，取消后恢复`, async ({
		page,
	}) => {
		await page.goto(`${process.env.KANBAN_FIXTURE_URL}?view=relations&canvas=1`);
		await expect(page.locator(".v-kanban__relation")).toHaveCount(4);
		for (let step = 0; step < 4; step += 1) {
			await page.getByRole("button", { name: "Zoom out" }).click();
		}
		await settle(page);

		const original = await box(page, '[data-card-id="a"]');
		const board = await box(page, ".v-kanban__scroller");
		const viewport = await box(page, ".v-kanban-canvas__viewport");
		const destination =
			side === "left" ? board.x - original.width - 40 : board.x + board.width + 40;
		// 整张浮起卡片越过看板边界，但仍处于画布视口内。
		expect(destination).toBeGreaterThan(viewport.x);
		expect(destination + original.width).toBeLessThan(viewport.x + viewport.width);
		await page.mouse.move(original.x + 10, original.y + 10);
		await page.mouse.down();
		await page.mouse.move(original.x + 30, original.y + 10, { steps: 3 });
		await page.mouse.move(destination + 10, original.y + 10, { steps: 10 });
		await expect(page.locator(".v-kanban__ghost")).toHaveCount(1);
		await expect
			.poll(async () => {
				const ghost = await box(page, ".v-kanban__ghost");
				const target = await box(page, '[data-card-id="d"]');
				return near((await endpoints(page, "a", "d")).start, sides(ghost, target).start);
			})
			.toBe(true);

		// SVG 的几何端点即使被祖先裁掉也正确。只临时开放描边命中，用浏览器的实际
		// hit testing 检查看板外这段线确实没有被裁剪，不改变几何或绘制外观。
		const visible = await page.locator(lineSelector).evaluate((node) => {
			const path = node as SVGPathElement;
			const matrix = path.getScreenCTM();
			if (!matrix) throw new Error("relation has no screen transform");
			const point = path.getPointAtLength(Math.min(path.getTotalLength() / 4, 12 / matrix.a));
			const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
			const previous = path.style.pointerEvents;
			path.style.pointerEvents = "stroke";
			const hit = document.elementFromPoint(screen.x, screen.y) === path;
			path.style.pointerEvents = previous;
			return { x: screen.x, y: screen.y, hit };
		});
		const currentBoard = await box(page, ".v-kanban__scroller");
		if (side === "left") expect(visible.x).toBeLessThan(currentBoard.x);
		else expect(visible.x).toBeGreaterThan(currentBoard.x + currentBoard.width);
		expect(visible.x).toBeGreaterThan(viewport.x);
		expect(visible.x).toBeLessThan(viewport.x + viewport.width);
		expect(visible.y).toBeGreaterThan(viewport.y);
		expect(visible.y).toBeLessThan(viewport.y + viewport.height);
		expect(visible.hit).toBe(true);

		await page.keyboard.press("Escape");
		await page.mouse.up();
		await expect(page.locator(".v-kanban__ghost")).toHaveCount(0);
		await settle(page);
		const restored = await box(page, '[data-card-id="a"]');
		expect(near(restored, original)).toBe(true);
		const target = await box(page, '[data-card-id="d"]');
		expect(near((await endpoints(page, "a", "d")).start, sides(restored, target).start)).toBe(
			true,
		);
		expect(await page.evaluate(() => window.__moves)).toEqual([]);
	});
}
