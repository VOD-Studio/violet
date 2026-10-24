import { expect, test } from "@playwright/test";
import { loadClient } from "./client";
import {
	ARTICLE_START,
	blockAsset,
	collectUnexpectedDiagnostics,
	expectArticlePreserved,
	openWithArticleSnapshot,
} from "./rich-content-harness";

test("评论抽屉关闭时不请求模块，打开失败不替换正文且重新载入后可再次打开", async ({
	page,
	context,
}) => {
	await loadClient(context);
	const asset = await blockAsset(context, page, /\/assets\/CommentDrawer-[^/]+\.js$/);
	const diagnostics = collectUnexpectedDiagnostics(page, asset.blockedUrls);
	const snapshot = await openWithArticleSnapshot(context, page, "/blog/contract-rich-code");
	await expect(page.locator("[data-article-content] pre.shiki")).toBeVisible();
	await page.waitForLoadState("networkidle");
	expect(asset.blockedUrls.size).toBe(0);
	expect(asset.successfulUrls).toEqual([]);
	await expect(page.getByRole("dialog", { name: "评论", exact: true })).toHaveCount(0);

	await page.getByRole("button", { name: "查看或发表评论", exact: true }).click();
	const failure = page.getByRole("alert").filter({ hasText: "评论面板加载失败" });
	await expect(failure).toBeVisible();
	await expect(failure.getByRole("button", { name: "重新载入页面", exact: true })).toBeVisible();
	expect(asset.blockedUrls.size).toBeGreaterThan(0);
	expect(asset.successfulUrls).toEqual([]);
	await expectArticlePreserved(page, snapshot);
	expect(asset.documents).toHaveLength(1);

	asset.release();
	await Promise.all([
		page.waitForEvent("load"),
		failure.getByRole("button", { name: "重新载入页面", exact: true }).click(),
	]);
	await expect(page.getByRole("dialog", { name: "评论", exact: true })).toHaveCount(0);
	await page.getByRole("button", { name: "查看或发表评论", exact: true }).click();
	const drawer = page.getByRole("dialog", { name: "评论", exact: true });
	await expect(drawer).toBeVisible();
	await expect(drawer.getByRole("button", { name: "关闭", exact: true })).toBeVisible();
	await expect(failure).toHaveCount(0);
	expect(asset.successfulUrls.some((url) => asset.blockedUrls.has(url))).toBe(true);
	expect(asset.documents).toHaveLength(2);
	await expect(page.locator("[data-article-content]")).toContainText(ARTICLE_START);
	await drawer.getByRole("button", { name: "关闭", exact: true }).click();
	await expect(drawer).toHaveCount(0);
	expect(await diagnostics()).toEqual([]);
});
test("批注工具下载期间和失败后，原生文字选区仍可见", async ({ page, context }) => {
	await loadClient(context);
	const download = Promise.withResolvers<void>();
	const blockedUrls = new Set<string>();
	const diagnostics = collectUnexpectedDiagnostics(page, blockedUrls);
	await context.route(/\/assets\/FloatingToolbar-[^/]+\.js$/, async (route) => {
		blockedUrls.add(route.request().url());
		await download.promise;
		await route.abort("failed");
	});
	try {
		await page.goto("/blog/contract-rich-code");
		await expect(page.locator("[data-article-content] pre.shiki")).toBeVisible();
		const paragraph = page
			.locator("[data-article-content] p")
			.filter({ hasText: ARTICLE_START });
		const points = await paragraph.evaluate((element) => {
			const text = element.firstChild;
			if (!text) throw new Error("正文缺少可选文本");
			const start = document.createRange();
			start.setStart(text, 0);
			start.setEnd(text, 1);
			const end = document.createRange();
			end.setStart(text, 5);
			end.setEnd(text, 6);
			const first = start.getBoundingClientRect();
			const last = end.getBoundingClientRect();
			return {
				x1: first.left + 1,
				y1: first.top + first.height / 2,
				x2: last.right - 1,
				y2: last.top + last.height / 2,
			};
		});
		await page.mouse.move(points.x1, points.y1);
		await page.mouse.down();
		await page.mouse.move(points.x2, points.y2, { steps: 8 });
		await page.mouse.up();
		await expect.poll(() => blockedUrls.size).toBeGreaterThan(0);
		await expect
			.poll(() => page.evaluate(() => window.getSelection()?.toString()))
			.toBe("增强加载失败");
		const selectionOpacity = () =>
			paragraph.evaluate((element) => {
				const canvas = document.createElement("canvas");
				canvas.width = 1;
				canvas.height = 1;
				const context = canvas.getContext("2d");
				if (!context) throw new Error("浏览器无法检查选区颜色");
				context.fillStyle = getComputedStyle(element, "::selection").backgroundColor;
				context.fillRect(0, 0, 1, 1);
				return context.getImageData(0, 0, 1, 1).data[3];
			});
		expect(await selectionOpacity()).toBeGreaterThan(0);
		download.resolve();
		await expect(page.getByRole("alert").filter({ hasText: "批注工具加载失败" })).toBeVisible();
		expect(await selectionOpacity()).toBeGreaterThan(0);
		await expect(paragraph).toContainText(ARTICLE_START);
		expect(await diagnostics()).toEqual([]);
	} finally {
		download.resolve();
	}
});

test("段评下载期间可关闭，再次打开失败后仍可关闭", async ({ page, context }) => {
	await loadClient(context);
	const download = Promise.withResolvers<void>();
	const blockedUrls = new Set<string>();
	const diagnostics = collectUnexpectedDiagnostics(page, blockedUrls);
	await context.route(/\/assets\/BlockAnnotationComposer-[^/]+\.js$/, async (route) => {
		blockedUrls.add(route.request().url());
		await download.promise;
		await route.abort("failed");
	});
	try {
		await page.goto("/blog/contract-rich-code");
		await expect(page.locator("[data-article-content] pre.shiki")).toBeVisible();
		const paragraph = page
			.locator("[data-article-content] p")
			.filter({ hasText: ARTICLE_START });
		const panel = page.getByRole("dialog", { name: "发表段评", exact: true });
		await paragraph.hover();
		await page.getByRole("button", { name: "发表段评", exact: true }).click();
		await expect(panel.getByRole("status")).toHaveText("正在准备段评…");
		await panel.getByRole("button", { name: "关闭段评", exact: true }).click();
		await expect(panel).not.toBeVisible();
		await paragraph.hover();
		await page.getByRole("button", { name: "发表段评", exact: true }).click();
		await expect(panel).toBeVisible();
		download.resolve();
		await expect(panel.getByRole("alert")).toContainText("段评表单加载失败");
		await panel.getByRole("button", { name: "关闭段评", exact: true }).click();
		await expect(panel).not.toBeVisible();
		await expect(paragraph).toContainText(ARTICLE_START);
		expect(await diagnostics()).toEqual([]);
	} finally {
		download.resolve();
	}
});
