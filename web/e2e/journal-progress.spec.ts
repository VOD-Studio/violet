import { expect, test } from "@playwright/test";
import { loadClient } from "./client";

test("同日混排、进展筛选与按日展开提交", async ({ page, context }) => {
	await loadClient(context);
	const detailPath = /\/api\/v1\/journal\/progress\//;
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
