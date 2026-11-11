import { expect, test } from "@playwright/test";
import { loadClient } from "./client";

test("拖动纸片不越过列表，落点槽随目标移动，松手后才改变顺序", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 1000 });
	await page.goto("/ui?open=sortable");
	await page.waitForLoadState("networkidle");
	const inspector = page.getByRole("dialog", { name: "拖拽排序", exact: true });
	const list = inspector.getByRole("list", { name: "章节顺序" });
	const rows = list.locator(".v-sortable__row");
	await expect(rows).toHaveCount(4);
	await page.evaluate(() => document.fonts.ready);
	const titles = list.locator(".v-sortable__content > div > span:last-child");
	const initial = await titles.allTextContents();
	const source = await list.locator(".v-sortable__handle").nth(2).boundingBox();
	const boundary = await list.boundingBox();
	if (!source || !boundary) throw new Error("排序列表没有实际占地");

	await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
	await page.mouse.down();
	await page.mouse.move(source.x + source.width / 2, boundary.y + boundary.height + 80, {
		steps: 16,
	});
	const lifted = list.locator("[data-lifted] .v-sortable__row");
	const marker = list.locator(".v-sortable__placeholder");
	await expect(lifted).toBeVisible();
	await expect(marker).toBeVisible();
	await expect
		.poll(async () => {
			const paper = await lifted.boundingBox();
			const slot = await marker.boundingBox();
			return paper && slot
				? {
						inside: paper.y + paper.height <= boundary.y + boundary.height + 1,
						atLastSlot:
							Math.abs(slot.y + slot.height - (boundary.y + boundary.height - 4)) <=
							1,
					}
				: null;
		})
		.toEqual({ inside: true, atLastSlot: true });
	await expect(titles).toHaveText(initial);

	await page.mouse.up();
	await expect(titles).toHaveText([initial[0], initial[1], initial[3], initial[2]]);
	await expect(marker).toHaveCount(0);
	await expect(inspector.locator(".v-sortable__announcement")).toHaveText("已放在第 4 位");
});

test("键盘取消恢复原位且不关闭检视台", async ({ page, context }) => {
	await loadClient(context);
	await page.goto("/ui?open=sortable");
	await page.waitForLoadState("networkidle");
	const inspector = page.getByRole("dialog", { name: "拖拽排序", exact: true });
	const list = inspector.getByRole("list", { name: "章节顺序" });
	const titles = list.locator(".v-sortable__content > div > span:last-child");
	await expect(titles).toHaveCount(4);
	const initial = await titles.allTextContents();
	const boundary = await list.boundingBox();
	if (!boundary) throw new Error("排序列表没有实际占地");
	const handle = list.locator(".v-sortable__handle").first();
	await handle.focus();
	await page.keyboard.press("Space");
	await expect(list.locator("[data-lifted]")).toHaveCount(1);
	await page.keyboard.press("ArrowDown");
	await expect
		.poll(async () =>
			list
				.locator(".v-sortable__placeholder")
				.evaluate((slot) => slot.getBoundingClientRect().top),
		)
		.toBeGreaterThan(boundary.y + 48);
	await page.keyboard.press("Escape");
	await expect(inspector).toBeVisible();
	await expect(titles).toHaveText(initial);
	await expect(list.locator(".v-sortable__placeholder")).toHaveCount(0);
	await expect(handle).toBeFocused();
});
