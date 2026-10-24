import { basename, join } from "node:path";
import { expect, test } from "@playwright/test";
import { loadClient } from "./client";
import {
	ARTICLE_START,
	blockAsset,
	collectUnexpectedDiagnostics,
	expectArticlePreserved,
	openWithArticleSnapshot,
} from "./rich-content-harness";

const CODE_SOURCE = 'const recoveryMessage = "正文仍可阅读";';
const DIAGRAM_SOURCE = "flowchart LR\n  A[开始阅读] --> B[完整图表]";

test.beforeEach(async ({ context }) => {
	// 使用实际 CDN 字体分片，避免外部网络决定模块恢复用例的时限；OFL 许可见 src/assets/fonts/diagram/。
	for (const pattern of [
		"https://cn-font.claude-code-best.win/packages/xiaolai/dist/Xiaolai/**",
		"https://cdn.jsdelivr.net/npm/@excalidraw/excalidraw@0.18.1/dist/prod/fonts/Excalifont/**",
	]) {
		await context.route(pattern, (route) =>
			route.fulfill({
				path: join(
					import.meta.dirname,
					"fixtures/diagram-fonts",
					basename(new URL(route.request().url()).pathname),
				),
				headers: { "access-control-allow-origin": "*" },
			}),
		);
	}
});

for (const chunk of ["DiagramBlock", "mermaid.core"]) {
	test(`${chunk} 下载失败仅降级图表，重新载入页面后恢复完整 SVG`, async ({ page, context }) => {
		await loadClient(context);
		await page.emulateMedia({ reducedMotion: "reduce" });
		const pattern = new RegExp(`/assets/${chunk.replaceAll(".", "\\.")}-[^/]+\\.js$`);
		const asset = await blockAsset(context, page, pattern);
		const diagnostics = collectUnexpectedDiagnostics(page, asset.blockedUrls);
		const snapshot = await openWithArticleSnapshot(
			context,
			page,
			"/blog/contract-rich-diagram",
		);
		await page
			.locator("[data-article-content] [data-content-preparation]")
			.first()
			.scrollIntoViewIfNeeded();
		await expect.poll(() => asset.blockedUrls.size).toBeGreaterThan(0);
		const failure = page.getByRole("alert").filter({ hasText: /图表.*失败/ });
		await expect(failure).toBeVisible();
		await expect(page.locator("[data-article-content] pre")).toContainText(DIAGRAM_SOURCE);
		await expect(
			failure.getByRole("button", { name: "重新载入页面", exact: true }),
		).toBeVisible();
		expect(asset.successfulUrls).toEqual([]);
		await expectArticlePreserved(page, snapshot);
		expect(asset.documents).toHaveLength(1);

		asset.release();
		await Promise.all([
			page.waitForEvent("load"),
			failure.getByRole("button", { name: "重新载入页面", exact: true }).click(),
		]);
		await page.locator("[data-article-content]").scrollIntoViewIfNeeded();
		const svg = page.locator('[data-type="diagram-block"] [role="img"] > svg');
		await expect(svg).toBeVisible();
		await expect(svg).toContainText("开始阅读");
		await expect(svg).toContainText("完整图表");
		await expect(svg.locator("path").first()).toBeAttached();
		await expect(svg.locator("..")).toHaveCSS("animation-name", "none");
		await expect(failure).toHaveCount(0);
		expect(asset.successfulUrls.some((url) => asset.blockedUrls.has(url))).toBe(true);
		expect(asset.documents).toHaveLength(2);
		await expect(page.locator("[data-article-content]")).toContainText(ARTICLE_START);
		expect(await diagnostics()).toEqual([]);
	});
}

test("代码样式下载失败保留源码，局部重试重新请求 CSS 且不替换正文和 document", async ({
	page,
	context,
}) => {
	await loadClient(context);
	const asset = await blockAsset(context, page, /\/assets\/CodeCard-[^/]+\.css$/);
	const diagnostics = collectUnexpectedDiagnostics(page, asset.blockedUrls);
	const snapshot = await openWithArticleSnapshot(context, page, "/blog/contract-rich-code");
	await page
		.locator("[data-article-content] [data-content-preparation]")
		.first()
		.scrollIntoViewIfNeeded();
	const failure = page.getByRole("alert").filter({ hasText: "代码高亮加载失败" });
	await expect(failure).toBeVisible();
	await expect(page.locator("[data-article-content] pre")).toHaveText(CODE_SOURCE);
	await expectArticlePreserved(page, snapshot);
	expect(asset.blockedUrls.size).toBeGreaterThan(0);
	expect(asset.successfulUrls).toEqual([]);

	asset.release();
	await failure.getByRole("button", { name: "重试", exact: true }).click();
	const highlighted = page.locator("[data-article-content] pre.shiki");
	await expect(highlighted).toBeVisible();
	await expect(highlighted).toHaveText(CODE_SOURCE);
	await expect(highlighted.locator("code span[style]").first()).toBeAttached();
	await expect(failure).toHaveCount(0);
	expect(asset.successfulUrls.some((url) => asset.blockedUrls.has(url))).toBe(true);
	await expectArticlePreserved(page, snapshot);
	expect(asset.documents).toHaveLength(1);
	expect(await diagnostics()).toEqual([]);
});
