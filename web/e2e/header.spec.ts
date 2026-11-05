import { expect, test } from "@playwright/test";
import { loadClient } from "./client";

test("Header 博客二级菜单只标记精确命中的当前页", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	for (const route of [
		{ path: "/blog/archive", current: "归档", inactive: "全部文章" },
		{ path: "/blog", current: "全部文章", inactive: "归档" },
	]) {
		await page.goto(route.path);
		await page.waitForLoadState("networkidle");
		await page
			.getByRole("navigation", { name: "主导航" })
			.getByRole("link", { name: "博客", exact: true })
			.hover();
		const panel = page.getByRole("group", { name: "博客二级菜单" });
		await expect(
			panel.getByRole("link", { name: new RegExp(`^${route.current}`) }),
		).toHaveAttribute("aria-current", "page");
		await expect(
			panel.getByRole("link", { name: new RegExp(`^${route.inactive}`) }),
		).not.toHaveAttribute("aria-current");
	}
});

test("Header 品牌档案由 hover 与键盘展开，点击不切换面板", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/blog");
	await page.waitForLoadState("networkidle");
	const trigger = page.getByRole("button", { name: /站长开源档案与简介/ });
	const panel = page.getByRole("region", { name: "站长开源档案与简介" });
	await trigger.hover();
	await expect(panel).toBeVisible();
	await trigger.click();
	await expect(trigger).toHaveAttribute("aria-expanded", "true");
	await expect(panel.getByRole("link", { name: /开源项目/ })).toHaveAttribute(
		"href",
		"/projects",
	);
	await expect(panel.getByRole("link", { name: /人设/ })).toHaveAttribute("href", "/persona");
	await page.keyboard.press("Escape");
	await expect(panel).toHaveCount(0);
	await page.mouse.move(1300, 800);
	await trigger.focus();
	await page.keyboard.press("Tab");
	await page.keyboard.press("Shift+Tab");
	await expect(panel).toBeVisible();
	await page.keyboard.press("Tab");
	await expect
		.poll(() => panel.evaluate((element) => element.contains(document.activeElement)))
		.toBe(true);
	await panel.getByRole("link", { name: /人设/ }).click();
	await expect(page).toHaveURL(/\/persona$/);
	await expect(panel).toHaveCount(0);
});
