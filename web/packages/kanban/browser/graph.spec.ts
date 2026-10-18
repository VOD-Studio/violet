import { expect, type Page, test } from "@playwright/test";
import { box } from "./lines.ts";

const card = (id: string) => `[data-card-id="${id}"]`;
const viewport = (page: Page) => page.locator(".v-kanban-canvas__viewport");

async function open(page: Page, query = "", first = "a") {
	await page.goto(`${process.env.KANBAN_FIXTURE_URL}?view=graph${query}`);
	await expect(page.locator(card(first))).toBeVisible();
	// 适应窗口落定后再动手
	await expect(viewport(page)).toBeVisible();
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
	);
}

test.describe("画布里的关系图", () => {
	test("聚焦视口之外的卡片时画布平移到刚好露出，页面不会跳走", async ({ page }) => {
		await open(page, "&many=120", "n0");
		const view = await box(page, ".v-kanban-canvas__viewport");
		const far = page.locator(card("n119"));
		const farBox = await far.boundingBox();
		expect(farBox && farBox.y + farBox.height > view.y + view.height).toBe(true);
		expect(await page.evaluate(() => window.scrollY)).toBe(0);

		await far.focus();

		await expect
			.poll(async () => {
				const rect = await far.boundingBox();
				if (!rect) return false;
				return (
					rect.x >= view.x &&
					rect.y >= view.y &&
					rect.x + rect.width <= view.x + view.width &&
					rect.y + rect.height <= view.y + view.height
				);
			})
			.toBe(true);
		// 浏览器聚焦时本会按卡片原来的布局位置把整页滚走，而画布已经把它平移到了眼前
		expect(await page.evaluate(() => window.scrollY)).toBe(0);
	});
});
