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

test("Header 右药丸的控件常驻可见，游客只有季节与外观和登录", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/blog");
	await page.waitForLoadState("networkidle");
	// 不悬停、不聚焦：右药丸里的入口一开始就看得见
	const header = page.locator("header").first();
	await expect(header.getByRole("button", { name: /^季节与外观：/ })).toBeVisible();
	await expect(header.getByRole("link", { name: "登录", exact: true })).toBeVisible();
	await expect(header.getByRole("button", { name: /^消息/ })).toHaveCount(0);
	await expect(header.getByRole("button", { name: "用户菜单" })).toHaveCount(0);
	// 外观与主题合并成同一个入口：面板里有明暗三态，顶栏没有独立的外观开关
	await expect(header.getByRole("radiogroup", { name: "外观切换" })).toHaveCount(0);
	await header.getByRole("button", { name: /^季节与外观：/ }).click();
	const panel = page.getByRole("dialog", { name: "季节与外观", exact: true });
	await expect(panel.getByRole("radiogroup", { name: "外观切换" })).toBeVisible();
	await expect(panel.getByRole("radiogroup", { name: "主题", exact: true })).toBeVisible();
});

test("Header 一级入口随登录态：聊天在 SSR 首帧就已确定，水合无差异", async ({ page, context }) => {
	await loadClient(context);
	const hydrationErrors: string[] = [];
	page.on("pageerror", (error) => {
		if (/hydration|hydrated|React error #418/i.test(error.message)) {
			hydrationErrors.push(error.message);
		}
	});
	const navOf = (html: string) =>
		html.match(/<nav[^>]*aria-label="主导航"[\s\S]*?<\/nav>/)?.[0] ?? "";

	const guest = await context.request.get("/");
	expect(navOf(await guest.text())).not.toContain("聊天");

	await context.addCookies([
		{ name: "contract_admin", value: "1", url: "http://127.0.0.1:4173" },
	]);
	const member = await context.request.get("/");
	expect(navOf(await member.text())).toContain("聊天");

	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	await expect(
		page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "聊天" }),
	).toHaveAttribute("href", "/chat");
	expect(hydrationErrors).toEqual([]);
});

test("Header 在已登录页面登出后，导航立即回到游客入口", async ({ page, context }) => {
	await loadClient(context);
	await context.addCookies([
		{ name: "contract_admin", value: "1", url: "http://127.0.0.1:4173" },
	]);
	await page.route("**/api/v1/auth/logout", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ data: { message: "ok" } }),
		}),
	);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	const nav = page.getByRole("navigation", { name: "主导航" });
	await expect(nav.getByRole("link", { name: "聊天" })).toBeVisible();

	await page.getByRole("button", { name: "用户菜单" }).click();
	await page.getByRole("menuitem", { name: "登出" }).click();

	await expect(nav.getByRole("link", { name: "聊天" })).toHaveCount(0);
	await expect(
		page.locator("header").getByRole("link", { name: "登录", exact: true }),
	).toBeVisible();
});

test("Header 向下滚动后导航收起，往回滚恢复", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	const bar = page.locator('[data-slot="site-navbar"]');
	const right = page.locator('[data-slot="navbar-right"]');
	await expect(bar).toHaveAttribute("data-collapsed", "false");

	await page.evaluate(() => window.scrollTo(0, 800));
	await expect(bar).toHaveAttribute("data-collapsed", "true");
	await expect(right).toHaveAttribute("inert", "");
	await expect(
		page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "首页" }),
	).toBeVisible();

	await page.evaluate(() => window.scrollTo(0, 700));
	await expect(bar).toHaveAttribute("data-collapsed", "false");
	await expect(right).not.toHaveAttribute("inert");
});

test("Header 路由切换超过 300ms 才在导航下沿显示加载进度线，完成后收起", async ({
	page,
	context,
}) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/");
	await page.waitForLoadState("networkidle");
	const line = page.getByRole("progressbar", { name: "页面加载" });

	let release: (() => void) | undefined;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/api/v1/notes**", async (route) => {
		await gate;
		await route.fallback();
	});
	await page
		.getByRole("navigation", { name: "主导航" })
		.getByRole("link", { name: "手记" })
		.click();
	await expect(line).toBeVisible();
	expect(Number(await line.getAttribute("aria-valuenow"))).toBeLessThan(100);

	release?.();
	await expect(page).toHaveURL(/\/notes$/);
	await expect(line).toHaveCount(0);
});
