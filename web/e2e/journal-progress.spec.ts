import { expect, test } from "@playwright/test";
import { loadClient } from "./client";

const detailPath = /\/api\/v1\/journal\/progress\//;

test("同日混排、进展筛选与按日展开提交", async ({ page, context }) => {
	await loadClient(context);
	const detailRequests: string[] = [];
	page.on("request", (request) => {
		if (detailPath.test(new URL(request.url()).pathname)) detailRequests.push(request.url());
	});
	await page.goto("/journal");
	const note = page.getByRole("link", { name: "缓存接管笔记" });
	const version = page.getByRole("link", { name: "v2.0.0" });
	await expect(note).toBeVisible();
	await expect(version).toHaveAttribute(
		"href",
		"https://github.com/VOD-Studio/violet/releases/tag/v2.0.0",
	);
	await expect(page.locator('main time[datetime="2026-08-11"]')).toHaveCount(1);
	const more = page.getByRole("button", { name: "另 2 个提交" });
	await expect(more).toHaveAttribute("aria-expanded", "false");
	const extra = page.getByRole("link", { name: /第 7 条契约提交/ });
	await expect(extra).toBeHidden();
	expect(detailRequests).toEqual([]);
	await more.focus();
	await more.press("Enter");
	await expect(extra).toBeVisible();
	await expect(extra).toHaveAttribute("href", /\/commit\/0+7$/);
	await expect(more).toHaveAttribute("aria-expanded", "true");
	await more.press("Space");
	await expect(extra).toBeHidden();

	await page.getByRole("radio", { name: "进展" }).click();
	await expect(page).toHaveURL(/type=progress/);
	await expect(note).toBeHidden();
	await expect(version).toBeVisible();
});

for (const width of [1440, 390]) {
	test(`${width}px 进展明细加载失败后，重试按钮的键盘焦点环不被裁掉`, async ({
		page,
		context,
	}) => {
		await page.setViewportSize({ width, height: 800 });
		await page.emulateMedia({ reducedMotion: "reduce" });
		await loadClient(context);
		await context.route(detailPath, (route) =>
			route.fulfill({
				status: 503,
				json: { error: "SERVICE_UNAVAILABLE", message: "暂时无法读取提交" },
			}),
		);

		await page.goto("/journal");
		const more = page.getByRole("button", { name: "另 2 个提交" });
		await more.press("Enter");
		const retry = page.getByRole("button", { name: "重试加载提交" });
		await expect(retry).toBeVisible();
		await page.keyboard.press("Tab");
		await expect(retry).toBeFocused();

		const { bleed, clearance } = await retry.evaluate((button) => {
			const style = getComputedStyle(button);
			const bleed =
				Number.parseFloat(style.outlineWidth) + Number.parseFloat(style.outlineOffset);
			const item = button.getBoundingClientRect();
			let clearance = Number.POSITIVE_INFINITY;
			for (let parent = button.parentElement; parent; parent = parent.parentElement) {
				const { overflowX, overflowY } = getComputedStyle(parent);
				const clip = parent.getBoundingClientRect();
				if (overflowX === "hidden" || overflowX === "clip") {
					clearance = Math.min(clearance, item.left - clip.left, clip.right - item.right);
				}
				if (overflowY === "hidden" || overflowY === "clip") {
					clearance = Math.min(clearance, item.top - clip.top, clip.bottom - item.bottom);
				}
			}
			return { bleed: style.outlineStyle === "none" ? 0 : bleed, clearance };
		});
		expect(bleed).toBeGreaterThan(0);
		expect(clearance).toBeGreaterThanOrEqual(bleed);

		await context.unroute(detailPath);
		await retry.click();
		await expect(page.getByRole("link", { name: /第 7 条契约提交/ })).toBeVisible();
	});
}
