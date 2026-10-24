import { expect, test } from "@playwright/test";
import { appearanceContext, contrastRatio, SEMANTIC_TOKENS, scopeColors } from "./theme-harness";

const VIEWPORTS = [
	{ width: 390, height: 844 },
	{ width: 1440, height: 900 },
];
const STATUS_TOKENS = [
	"destructive",
	"destructive-foreground",
	"warning",
	"warning-foreground",
	"success",
	"success-foreground",
];

for (const viewport of VIEWPORTS) {
	for (const appearance of ["light", "dark", "system"] as const) {
		for (const contrast of ["no-preference", "more"] as const) {
			test(`首页主题契约：${appearance} / ${contrast} @ ${viewport.width}`, async ({
				browser,
			}) => {
				test.setTimeout(90_000);
				const firstContext = await appearanceContext(browser, appearance, {
					blockScripts: true,
					contrast,
				});
				const firstPage = await firstContext.newPage();
				await firstPage.setViewportSize(viewport);
				await firstPage.goto("/", { waitUntil: "load" });
				const resolved = appearance === "system" ? "dark" : appearance;
				await expect(firstPage.locator("html")).toHaveClass(
					new RegExp(`\\b${resolved}\\b`),
				);
				const firstRoot = await scopeColors(firstPage, "html");
				const firstPublic = await scopeColors(firstPage, ".dialect-public");
				const brand = await scopeColors(firstPage, ".dialect-public", [
					"brand-9",
					"brand-10",
					"brand-11",
					"brand-8",
				]);
				expect(firstPublic.primary.value).toBe(brand["brand-9"].value);
				expect(firstPublic["primary-hover"].value).toBe(brand["brand-10"].value);
				expect(firstPublic.link.value).toBe(brand["brand-11"].value);
				expect(firstPublic.ring.value).toBe(brand["brand-8"].value);
				expect(firstPublic["primary-text"].value).toBe(brand["brand-11"].value);
				expect(firstRoot.primary.value).not.toBe(firstPublic.primary.value);
				for (const token of STATUS_TOKENS)
					expect(firstPublic[token]).toEqual(firstRoot[token]);
				expect(
					contrastRatio(firstPublic.foreground, firstPublic.background),
				).toBeGreaterThanOrEqual(4.5);
				expect(
					contrastRatio(firstPublic.link, firstPublic.background),
				).toBeGreaterThanOrEqual(4.5);
				expect(
					contrastRatio(firstPublic["primary-text"], firstPublic.background),
				).toBeGreaterThanOrEqual(4.5);
				expect(
					await firstPage.evaluate(
						() => document.documentElement.scrollWidth <= innerWidth,
					),
				).toBe(true);
				await firstContext.close();

				const hydratedContext = await appearanceContext(browser, appearance, { contrast });
				const page = await hydratedContext.newPage();
				await page.setViewportSize(viewport);
				await page.goto("/", { waitUntil: "load" });
				const label =
					appearance === "system" ? "跟随系统" : appearance === "dark" ? "暗黑" : "亮色";
				await expect(
					page
						.locator("header")
						.first()
						.getByRole("radio", { name: label, exact: true, includeHidden: true }),
				).toHaveAttribute("aria-checked", "true");
				await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${resolved}\\b`));
				expect(await scopeColors(page, "html"), "根 token 首帧与水合一致").toEqual(
					firstRoot,
				);
				expect(
					await scopeColors(page, ".dialect-public"),
					"公开 token 首帧与水合一致",
				).toEqual(firstPublic);
				expect(
					await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
				).toBe(true);
				await hydratedContext.close();
			});
		}
	}
}

for (const appearance of ["light", "dark"] as const) {
	for (const viewport of VIEWPORTS) {
		test(`工具方言契约：后台 ${appearance} @ ${viewport.width}`, async ({ browser }) => {
			const context = await appearanceContext(browser, appearance, { admin: true });
			const page = await context.newPage();
			await page.setViewportSize(viewport);
			await page.goto("/admin", { waitUntil: "load" });
			await expect(page.locator(".dialect-tool")).toBeVisible();
			const scope = await scopeColors(page, ".dialect-tool");
			const root = await scopeColors(page, "html", [
				...SEMANTIC_TOKENS,
				"action-neutral-9",
				"brand-8",
				"brand-11",
				"brand-3",
			]);
			expect(scope.primary.value).toBe(root["action-neutral-9"].value);
			expect(scope["primary-text"].value).toBe(root["action-neutral-9"].value);
			expect(contrastRatio(scope.primary, scope["primary-foreground"])).toBeGreaterThan(10);
			expect(scope.ring.value).toBe(root["brand-8"].value);
			expect(scope.link.value).toBe(root["brand-11"].value);
			expect(scope.selected.value).toBe(root["brand-3"].value);
			for (const token of STATUS_TOKENS) expect(scope[token]).toEqual(root[token]);
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
			).toBe(true);
			await context.close();
		});
	}

	test(`沉浸方言契约：图库灯箱 ${appearance}`, async ({ browser }) => {
		test.setTimeout(90_000);
		const context = await appearanceContext(browser, appearance);
		const page = await context.newPage();
		await page.goto("/galleries", { waitUntil: "load" });
		await page.locator('a[href="/galleries/contract-gallery"]').first().click();
		await page.waitForURL("**/galleries/contract-gallery");
		await page.locator("figure button").first().click();
		const immersive = page.locator(".dialect-immersive");
		await expect(immersive).toBeVisible();
		const stage = await scopeColors(page, ".dialect-immersive");
		const root = await scopeColors(page, "html");
		expect(stage.background.luminance).toBeLessThan(0.01);
		expect(contrastRatio(stage.primary, stage["primary-foreground"])).toBeGreaterThan(10);
		for (const token of STATUS_TOKENS) expect(stage[token]).toEqual(root[token]);
		await page.keyboard.press("Escape");
		await expect(immersive).toHaveCount(0);
		const surface = await scopeColors(page, ".dialect-public", ["primary", "brand-9"]);
		expect(surface.primary.value).toBe(surface["brand-9"].value);
		await context.close();
	});
}
