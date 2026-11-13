import { expect, test } from "@playwright/test";
import { loadClient } from "./client";
import { openClientPage } from "./support";

test("归档原址返回 200，只有旧系列路径永久迁移并保留查询", async ({ request }) => {
	const archive = await request.get("/blog/archive?tag=contract", {
		maxRedirects: 0,
	});
	expect(archive.status()).toBe(200);
	const normalized = await request.get("/blog/archive?tag=contract&source=repost&page=2", {
		maxRedirects: 0,
	});
	const archiveTarget = new URL(normalized.headers().location, "http://127.0.0.1:4173");
	expect(archiveTarget.pathname).toBe("/blog/archive");
	expect(Object.fromEntries(archiveTarget.searchParams)).toEqual({ tag: "contract" });
	for (const suffix of ["", "/contract-series"]) {
		const response = await request.get(`/Series${suffix}?tag=contract&source=original&page=2`, {
			maxRedirects: 0,
		});
		expect(response.status()).toBe(301);
		const target = new URL(response.headers().location, "http://127.0.0.1:4173");
		expect(target.pathname).toBe(`/blog/series${suffix}`);
		expect(Object.fromEntries(target.searchParams)).toEqual({
			tag: "contract",
			source: "original",
			page: "2",
		});
	}
});

test("旧系列直达保留浏览器片段，canonical 使用新路径", async ({ page, context }) => {
	await loadClient(context);
	await page.goto("/series/contract-series?tag=contract#chapters");
	await expect(page).toHaveURL(/\/blog\/series\/contract-series\?tag=contract#chapters$/);
	await expect(
		page.getByRole("heading", { level: 1, name: "缓存接管系列", exact: true }),
	).toBeVisible();
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		"href",
		/\/blog\/series\/contract-series$/,
	);
});

test("筛选与路径视图共享选择，改变维度重置页码", async ({ page, context }) => {
	await loadClient(context);
	await openClientPage(page, "/blog?page=2");
	await page.getByRole("combobox", { name: "文章标签" }).click();
	await page.getByRole("option", { name: /^Go/ }).click();
	await expect(page).toHaveURL(/\/blog\?tag=go$/);
	await expect(page.getByRole("link", { name: "壳层契约文章 1", exact: true })).toBeVisible();
	await expect(page.getByRole("link", { name: "壳层契约文章 2", exact: true })).toHaveCount(0);
	await page.getByRole("combobox", { name: "文章来源" }).click();
	await page.getByRole("option", { name: "原创", exact: true }).click();
	await expect(page).toHaveURL(/tag=go&source=original$/);
	await expect(page.getByRole("link", { name: "壳层契约文章 4", exact: true })).toHaveCount(0);
	const views = page.getByRole("group", { name: "博客视图" });
	await views.getByRole("link", { name: "系列", exact: true }).click();
	await expect(page).toHaveURL(/\/blog\/series\?tag=go&source=original$/);
	await expect(page.getByRole("link", { name: /缓存接管系列/ })).toBeVisible();
	await views.getByRole("link", { name: "归档", exact: true }).click();
	await expect(page).toHaveURL(/\/blog\/archive\?tag=go$/);
	await expect(page.getByRole("combobox", { name: "文章来源" })).toHaveCount(0);
	await expect(
		page.locator("#year-2026").getByRole("link", { name: "壳层契约文章 4", exact: true }),
	).toBeVisible();
	await expect(
		page.locator("#year-2026").getByRole("link", { name: "壳层契约文章 1", exact: true }),
	).toBeVisible();
	await views.getByRole("link", { name: "文章", exact: true }).click();
	await expect(page).toHaveURL(/\/blog\?tag=go$/);
});

test("文本标签直达与 canonical 不被 JSON 解析改写", async ({ page, context }) => {
	await loadClient(context);
	await openClientPage(page, "/blog?tag=1e3");
	const tag = page.getByRole("combobox", { name: "文章标签" });
	await expect(tag).toContainText("1e3");
	await expect(page.getByRole("link", { name: "壳层契约文章 2", exact: true })).toBeVisible();
	await expect(page.getByText("共 1 篇文章", { exact: true })).toBeVisible();
	await tag.click();
	await page.getByRole("option", { name: /^null/ }).click();
	const canonical = page.locator('link[rel="canonical"]');
	await expect(canonical).toHaveAttribute("href", /\/blog\?tag=null$/);
	const target = new URL((await canonical.getAttribute("href")) ?? "");
	await page.goto(`${target.pathname}${target.search}`);
	await expect(tag).toContainText("null");
	await expect(page.getByRole("link", { name: "壳层契约文章 3", exact: true })).toBeVisible();
	await expect(page.getByRole("link", { name: "壳层契约文章 2", exact: true })).toHaveCount(0);
});

test("视图切换保留键盘焦点且不触发整页淡出", async ({ page, context }) => {
	await loadClient(context);
	await page.emulateMedia({ reducedMotion: "no-preference" });
	await openClientPage(page, "/blog");
	await page.evaluate(() => {
		const original = document.startViewTransition.bind(document);
		document.documentElement.dataset.browseTransitions = "0";
		document.startViewTransition = (options) => {
			const root = document.documentElement;
			root.dataset.browseTransitions = String(Number(root.dataset.browseTransitions) + 1);
			return original(options);
		};
	});
	const views = page.getByRole("group", { name: "博客视图" });
	for (const destination of [
		{ name: "系列", path: "/blog/series" },
		{ name: "归档", path: "/blog/archive" },
		{ name: "文章", path: "/blog" },
	]) {
		const link = views.getByRole("link", { name: destination.name, exact: true });
		await link.focus();
		await link.press("Enter");
		await expect(page).toHaveURL(new RegExp(`${destination.path}$`));
		await expect(page.locator("html")).toHaveAttribute("data-browse-transitions", "0");
		await expect(link).toBeFocused();
	}
});

test("翻页仅改变页码，刷新与后退恢复对应文章", async ({ page, context }) => {
	await loadClient(context);
	await openClientPage(page, "/blog?tag=contract");
	await page.getByRole("button", { name: "下一页", exact: true }).click();
	await expect(page).toHaveURL(/\/blog\?tag=contract&page=2$/);
	const secondPage = page.getByRole("link", { name: "分页契约文章 13", exact: true });
	await expect(secondPage).toBeVisible();
	await expect(page.getByRole("link", { name: "壳层契约文章 1", exact: true })).toHaveCount(0);
	await page.reload();
	await expect(secondPage).toBeVisible();
	await expect(page.getByRole("combobox", { name: "文章标签" })).toContainText("契约");
	await page.goBack();
	await expect(page).toHaveURL(/\/blog\?tag=contract$/);
	await expect(page.getByRole("link", { name: "壳层契约文章 1", exact: true })).toBeVisible();
});

test("禁用 JavaScript 时文章、系列目录与归档首年仍可阅读", async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	await loadClient(context);
	const page = await context.newPage();
	try {
		await page.goto("http://127.0.0.1:4173/blog?tag=go&source=original");
		await expect(page.getByRole("link", { name: "壳层契约文章 1", exact: true })).toBeVisible();
		await expect(page.getByRole("link", { name: "壳层契约文章 4", exact: true })).toHaveCount(
			0,
		);
		await page.goto("http://127.0.0.1:4173/blog/series/contract-series");
		await expect(page.getByRole("link", { name: /壳层契约文章 1/ })).toBeVisible();
		await page.goto("http://127.0.0.1:4173/blog/archive");
		await expect(
			page.locator("#year-2026").getByRole("link", { name: "壳层契约文章 1", exact: true }),
		).toBeVisible();
		await expect(
			page.locator("#year-2025").getByRole("link", { name: "分页契约文章 19", exact: true }),
		).toHaveCount(0);
	} finally {
		await context.close();
	}
});

test("系列目录进入真实章节，再返回系列列表", async ({ page, context }) => {
	await loadClient(context);
	await openClientPage(page, "/blog");
	await page
		.getByRole("contentinfo")
		.getByRole("link", { name: "长卷连载", exact: true })
		.click();
	await expect(page).toHaveURL(/\/blog\/series$/);
	await page.getByRole("link", { name: /缓存接管系列/ }).click();
	await expect(page).toHaveURL(/\/blog\/series\/contract-series$/);
	await page.getByRole("link", { name: /壳层契约文章 1/ }).click();
	await expect(page).toHaveURL(/\/blog\/contract-post-1$/);
	await expect(page.locator("[data-article-content]")).toContainText(
		"首访缓存回归正文始终可读。",
	);
	await page.goBack();
	await page.getByRole("link", { name: "返回系列", exact: true }).click();
	await expect(page).toHaveURL(/\/blog\/series$/);
});

test("无匹配与越界页可恢复，而不是显示请求失败", async ({ page, context }) => {
	await loadClient(context);
	await openClientPage(page, "/blog?tag=missing-tag");
	await expect(page.getByText("没有匹配的内容", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "清除筛选", exact: true }).first().click();
	await expect(page).toHaveURL(/\/blog$/);
	await expect(page.getByRole("link", { name: "壳层契约文章 1", exact: true })).toBeVisible();
	await page.goto("/blog?tag=contract&page=99");
	await expect(page.getByText("这一页没有内容", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "返回第一页" }).click();
	await expect(page).toHaveURL(/\/blog\?tag=contract$/);
	await expect(page.getByRole("link", { name: "壳层契约文章 1", exact: true })).toBeVisible();
});

test("归档后年按可见区域加载，失败不抹掉首年且可重试", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 1280, height: 600 });
	let fail = true;
	let requests = 0;
	const { promise: pending, resolve: release } = Promise.withResolvers<void>();
	await page.route("**/api/v1/posts/archive/2025*", async (route) => {
		requests += 1;
		await pending;
		if (fail)
			await route.fulfill({
				status: 503,
				json: { error: "UNAVAILABLE", message: "暂时不可用" },
			});
		else await route.fallback();
	});
	await openClientPage(page, "/blog/archive");
	expect(requests).toBe(0);
	await page.locator("#year-2025").scrollIntoViewIfNeeded();
	await expect.poll(() => requests).toBeGreaterThan(0);
	await expect(page.locator("#year-2025")).toContainText("-- 篇");
	await expect(
		page.locator("#year-2026").getByRole("link", { name: "壳层契约文章 1", exact: true }),
	).toBeAttached();
	release();
	await expect(page.getByText("这一年暂时加载失败", { exact: true })).toBeVisible({
		timeout: 20_000,
	});
	fail = false;
	await page.getByRole("button", { name: "重试", exact: true }).click();
	await expect(
		page.locator("#year-2025").getByRole("link", { name: "分页契约文章 19", exact: true }),
	).toBeVisible();
});

test("归档哈希直达加载对应年并定位", async ({ page, context }) => {
	await loadClient(context);
	await openClientPage(page, "/blog/archive#year-2025");
	await expect(
		page.locator("#year-2025").getByRole("link", { name: "分页契约文章 19", exact: true }),
	).toBeVisible();
	await expect(page).toHaveURL(/\/blog\/archive#year-2025$/);
	const top = await page
		.locator("#year-2025")
		.evaluate((element) => element.getBoundingClientRect().top);
	expect(top).toBeGreaterThanOrEqual(0);
	expect(top).toBeLessThan(300);
});

test("系列不存在与服务失败分开呈现，重试恢复同一详情", async ({ page, context }) => {
	await loadClient(context);
	await openClientPage(page, "/blog/series/missing-series");
	await expect(page.getByText("系列不存在", { exact: true })).toBeVisible();
	await expect(page.getByRole("button", { name: "重试", exact: true })).toHaveCount(0);
	await page.getByRole("link", { name: "返回系列", exact: true }).click();
	let fail = true;
	await page.route("**/api/v1/series/contract-series", async (route) => {
		if (fail)
			await route.fulfill({
				status: 503,
				json: { error: "UNAVAILABLE", message: "暂时不可用" },
			});
		else await route.fallback();
	});
	await page.getByRole("link", { name: /缓存接管系列/ }).click();
	await expect(page.getByText("系列暂时加载失败", { exact: true })).toBeVisible({
		timeout: 20_000,
	});
	await expect(page.getByText("系列不存在", { exact: true })).toHaveCount(0);
	fail = false;
	await page.getByRole("button", { name: "重试", exact: true }).click();
	await expect(page).toHaveURL(/\/blog\/series\/contract-series$/);
	await expect(
		page.getByRole("heading", { level: 1, name: "缓存接管系列", exact: true }),
	).toBeVisible();
});

test("320 像素主操作不溢出，标签选择可用键盘完成", async ({ page, context }) => {
	await loadClient(context);
	await page.setViewportSize({ width: 320, height: 720 });
	await openClientPage(page, "/blog");
	for (const control of [
		page.getByRole("group", { name: "博客视图" }),
		page.getByRole("combobox", { name: "文章标签" }),
		page.getByRole("combobox", { name: "文章来源" }),
	]) {
		const box = await control.boundingBox();
		expect(box).not.toBeNull();
		if (!box) throw new Error("主操作没有可见区域");
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(320);
	}
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
		320,
	);
	const tag = page.getByRole("combobox", { name: "文章标签" });
	await tag.focus();
	await page.keyboard.press("Enter");
	await page.keyboard.press("Home");
	await page.keyboard.press("ArrowDown");
	await page.keyboard.press("Enter");
	await expect(page).toHaveURL(/tag=contract/);
	await expect(tag).toBeFocused();
	await page.keyboard.press("Tab");
	await expect(page.getByRole("combobox", { name: "文章来源" })).toBeFocused();
});
