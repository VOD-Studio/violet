import { expect, test } from "@playwright/test";
import { loadClient } from "./client";
import {
	ARTICLE_START,
	blockAsset,
	collectUnexpectedDiagnostics,
	expectArticlePreserved,
	openWithArticleSnapshot,
} from "./rich-content-harness";

const DIAGRAM_SOURCE = "flowchart LR\n  A[开始阅读] --> B[完整图表]";

test("中文图表的字体元数据与字形只向本站请求", async ({ page, context }) => {
	await loadClient(context);
	const requests: string[] = [];
	page.on("request", (request) => requests.push(request.url()));
	await page.goto("/blog/contract-rich-diagram");
	await page
		.locator("[data-article-content] [data-content-preparation]")
		.first()
		.scrollIntoViewIfNeeded();
	const svg = page.locator('[data-type="diagram-block"] [role="img"] > svg');
	await expect(svg).toContainText("开始阅读");
	// 图表字体：中文分片规则、中文字形与 Excalifont 都从本站 /assets 取
	expect(requests.some((url) => /\/assets\/result-[^/]+\.css$/.test(url))).toBe(true);
	expect(
		requests.some(
			(url) => url.startsWith("http://127.0.0.1:4173/assets/") && url.endsWith(".woff2"),
		),
	).toBe(true);
	expect(
		requests.filter(
			(url) =>
				/cn-font|@excalidraw|Excalifont|xiaolai/i.test(url) &&
				!url.startsWith("http://127.0.0.1:4173/"),
		),
	).toEqual([]);
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
