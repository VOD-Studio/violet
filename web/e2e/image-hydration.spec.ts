import { join } from "node:path";
import { type BrowserContext, expect, test } from "@playwright/test";
import { loadClient } from "./client";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

async function prepareImages(context: BrowserContext) {
	await loadClient(context);
	await context.route("**/uploads/contract-*.{png,gif}*", async (route) => {
		const url = new URL(route.request().url());
		if (url.pathname.endsWith(".gif")) {
			await route.fulfill({
				contentType: "image/gif",
				path: join(import.meta.dirname, "fixtures/article-small.gif"),
			});
			return;
		}
		const originalWidth = url.pathname.endsWith("contract-cover.png") ? 2000 : 120;
		const width = Math.min(originalWidth, Number(url.searchParams.get("w")) || originalWidth);
		await route.fulfill({
			contentType: "image/svg+xml",
			body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.floor(width / 2)}"><rect width="100%" height="100%" fill="red"/></svg>`,
		});
	});
	const hydration = Promise.withResolvers<void>();
	await context.route(/\/assets\/[^/]+\.js$/, async (route) => {
		await hydration.promise;
		await route.fallback();
	});
	return hydration.resolve;
}

test("SSR 图片早于水合加载完成后，小图和动图释放最小占位", async ({ page, context }) => {
	const release = await prepareImages(context);
	try {
		await page.goto("/blog/contract-rich-image-hydration", { waitUntil: "commit" });
		for (const name of ["水合前小图", "水合前动图"]) {
			const image = page.getByAltText(name, { exact: true });
			await image.scrollIntoViewIfNeeded();
			await expect
				.poll(() =>
					image.evaluate(
						(element: HTMLImageElement) =>
							element.complete && element.naturalWidth === 120,
					),
				)
				.toBe(true);
		}
		release();
		await expect(page.locator("[data-article-content] pre.shiki")).toBeAttached();
		for (const name of ["水合前小图", "水合前动图"]) {
			const image = page.getByAltText(name, { exact: true });
			await expect.poll(async () => (await image.boundingBox())?.height).toBe(60);
			expect((await image.boundingBox())?.width).toBe(120);
		}
	} finally {
		release();
	}
});

test("已加载的 SSR 封面足够清晰时，水合测量不会降档重下", async ({ page, context }) => {
	const release = await prepareImages(context);
	const requests: string[] = [];
	page.on("request", (request) => {
		if (request.url().includes("/uploads/contract-cover.png")) requests.push(request.url());
	});
	try {
		await page.goto("/blog/contract-rich-image-hydration", { waitUntil: "commit" });
		const cover = page.getByAltText("富内容故障契约：image-hydration", { exact: true });
		await expect
			.poll(() =>
				cover.evaluate(
					(image: HTMLImageElement) => image.complete && image.naturalWidth >= 342,
				),
			)
			.toBe(true);
		const selected = await cover.evaluate((image: HTMLImageElement) => image.currentSrc);
		release();
		await expect(page.locator("[data-article-content] pre.shiki")).toBeAttached();
		await page.waitForLoadState("networkidle");
		expect(await cover.evaluate((image: HTMLImageElement) => image.currentSrc)).toBe(selected);
		expect(requests).toEqual([selected]);
	} finally {
		release();
	}
});
