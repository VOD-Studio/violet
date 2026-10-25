import { expect, test } from "@playwright/test";
import { generateScales, normalizeTheme } from "@violetjs/theme";
import { SEASONS, type Season, THEME_COOKIE_NAME } from "../src/shared/lib/theme-preference";
import { THEME_PRESETS } from "../src/shared/lib/theme-presets";
import {
	appearanceContext,
	CONTRACT_ORIGIN,
	canonicalColor,
	contrastRatio,
	type ScopeColors,
	SEMANTIC_TOKENS,
	scopeColors,
} from "./theme-harness";

const VIEWPORTS = [
	{ width: 390, height: 844 },
	{ width: 1440, height: 900 },
];
/** 沉浸舞台不随主题变化的中性 token。 */
const FIXED_TOKENS = [
	"background",
	"foreground",
	"card",
	"primary",
	"primary-foreground",
	"primary-text",
	"link",
	"ring",
	"input",
	"border",
];
const STATUS_TOKENS = [
	"destructive",
	"destructive-foreground",
	"warning",
	"warning-foreground",
	"success",
	"success-foreground",
];

/** 站点时区的当前季节，与服务端解析口径一致：3–5 春、6–8 夏、9–11 秋、12–2 冬。 */
function seasonNow(): Season {
	const month = Number(
		new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", month: "numeric" }).format(
			new Date(),
		),
	);
	return (["winter", "spring", "summer", "autumn"] as const)[Math.floor((month % 12) / 3)];
}

/** 关键文字组合在真实浏览器中的对比度。 */
function expectReadableText(colors: ScopeColors) {
	for (const [text, background] of [
		["foreground", "background"],
		["muted-foreground", "card"],
		["link", "background"],
		["primary-text", "background"],
		["primary-foreground", "primary"],
		["selected-foreground", "selected"],
		["destructive-text", "background"],
		["warning-text", "background"],
		["success-text", "background"],
	]) {
		expect(
			contrastRatio(colors[text], colors[background]),
			`${text} 对 ${background}`,
		).toBeGreaterThanOrEqual(4.5);
	}
}

for (const theme of SEASONS) {
	for (const viewport of VIEWPORTS) {
		for (const appearance of ["light", "dark", "system"] as const) {
			for (const contrast of ["no-preference", "more"] as const) {
				test(`首页主题契约：${theme} / ${appearance} / ${contrast} @ ${viewport.width}`, async ({
					browser,
				}) => {
					test.setTimeout(90_000);
					const firstContext = await appearanceContext(browser, appearance, {
						blockScripts: true,
						contrast,
						theme,
					});
					const firstPage = await firstContext.newPage();
					await firstPage.setViewportSize(viewport);
					await firstPage.goto("/", { waitUntil: "load" });
					const resolved = appearance === "system" ? "dark" : appearance;
					await expect(firstPage.locator("html")).toHaveClass(
						new RegExp(`\\b${resolved}\\b`),
					);
					await expect(firstPage.locator("html")).toHaveAttribute("data-theme", theme);
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
					const { seed, knobs } = THEME_PRESETS[theme];
					const expected = generateScales(
						{ version: 1, seed, knobs },
						{
							appearance: resolved,
							contrast: contrast === "more" ? "more" : "standard",
						},
					);
					expect(brand["brand-9"].value, "品牌实色来自定稿种子").toBe(
						await canonicalColor(firstPage, expected.brand.steps[9]),
					);
					expect(firstPublic["primary-text"].value).toBe(brand["brand-11"].value);
					expect(firstRoot.primary.value).not.toBe(firstPublic.primary.value);
					for (const token of STATUS_TOKENS)
						expect(firstPublic[token]).toEqual(firstRoot[token]);
					expectReadableText(firstPublic);
					expect(
						await firstPage.evaluate(
							() => document.documentElement.scrollWidth <= innerWidth,
						),
					).toBe(true);
					await firstContext.close();

					const hydratedContext = await appearanceContext(browser, appearance, {
						contrast,
						theme,
					});
					const page = await hydratedContext.newPage();
					const hydrationErrors: string[] = [];
					page.on("pageerror", (error) => {
						if (/hydration|hydrated|React error #418/i.test(error.message))
							hydrationErrors.push(error.message);
					});
					await page.setViewportSize(viewport);
					await page.goto("/", { waitUntil: "load" });
					const label =
						appearance === "system"
							? "跟随系统"
							: appearance === "dark"
								? "暗黑"
								: "亮色";
					await expect(
						page
							.locator("header")
							.first()
							.getByRole("radio", { name: label, exact: true, includeHidden: true }),
					).toHaveAttribute("aria-checked", "true");
					await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${resolved}\\b`));
					await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
					expect(await scopeColors(page, "html"), "根 token 首帧与水合一致").toEqual(
						firstRoot,
					);
					expect(
						await scopeColors(page, ".dialect-public"),
						"公开 token 首帧与水合一致",
					).toEqual(firstPublic);
					expect(
						await page.evaluate(
							() => document.documentElement.scrollWidth <= innerWidth,
						),
					).toBe(true);
					expect(hydrationErrors, "水合不报错").toEqual([]);
					await hydratedContext.close();
				});
			}
		}
	}
}

/** 极浅、极深、高饱和浅黄与高饱和红的种子，覆盖实色档被收进门槛区间的两端。 */
const CUSTOM_SEEDS = ["#fffef0", "#05060a", "#ffeb3b", "#ff2d55"];

for (const seed of CUSTOM_SEEDS) {
	for (const appearance of ["light", "dark"] as const) {
		for (const contrast of ["no-preference", "more"] as const) {
			test(`自定义主题首帧：${seed} / ${appearance} / ${contrast}`, async ({ browser }) => {
				const custom = normalizeTheme({ version: 1, seed });
				const firstContext = await appearanceContext(browser, appearance, {
					blockScripts: true,
					contrast,
					custom,
				});
				const firstPage = await firstContext.newPage();
				await firstPage.goto("/", { waitUntil: "load" });
				await expect(firstPage.locator("html")).toHaveAttribute("data-theme", "custom");
				const firstPublic = await scopeColors(firstPage, ".dialect-public");
				const brand = await scopeColors(firstPage, ".dialect-public", ["brand-9"]);
				expect(brand["brand-9"].value, "品牌实色来自自定义种子").toBe(
					await canonicalColor(
						firstPage,
						generateScales(custom, {
							appearance,
							contrast: contrast === "more" ? "more" : "standard",
						}).brand.steps[9],
					),
				);
				expectReadableText(firstPublic);
				await firstContext.close();

				const hydratedContext = await appearanceContext(browser, appearance, {
					contrast,
					custom,
				});
				const page = await hydratedContext.newPage();
				const hydrationErrors: string[] = [];
				page.on("pageerror", (error) => {
					if (/hydration|hydrated|React error #418/i.test(error.message))
						hydrationErrors.push(error.message);
				});
				await page.goto("/", { waitUntil: "load" });
				await expect(page.locator("html")).toHaveAttribute("data-theme", "custom");
				expect(
					await scopeColors(page, ".dialect-public"),
					"自定义主题首帧与水合一致",
				).toEqual(firstPublic);
				expect(hydrationErrors, "水合不报错").toEqual([]);
				await hydratedContext.close();
			});
		}
	}
}

for (const appearance of ["light", "dark"] as const) {
	test(`自定义主题在工具方言：后台 ${appearance}`, async ({ browser }) => {
		const custom = normalizeTheme({ version: 1, seed: "#ffeb3b" });
		const context = await appearanceContext(browser, appearance, { admin: true, custom });
		const page = await context.newPage();
		await page.goto("/admin", { waitUntil: "load" });
		await expect(page.locator(".dialect-tool")).toBeVisible();
		await expect(page.locator("html")).toHaveAttribute("data-theme", "custom");
		const scope = await scopeColors(page, ".dialect-tool");
		const root = await scopeColors(page, "html", ["action-neutral-9", "brand-11"]);
		expect(scope.primary.value).toBe(root["action-neutral-9"].value);
		expect(scope.link.value).toBe(root["brand-11"].value);
		expectReadableText(scope);
		await context.close();
	});
}

test("非法的自定义主题不生效，按原来的预设渲染", async ({ browser }) => {
	const context = await appearanceContext(browser, "light", { blockScripts: true });
	await context.addCookies([
		{
			name: THEME_COOKIE_NAME,
			value: encodeURIComponent(
				JSON.stringify({
					v: 1,
					theme: "summer",
					custom: { version: 1, seed: "#fff;}html{display:none" },
				}),
			),
			url: CONTRACT_ORIGIN,
		},
	]);
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });
	await expect(page.locator("html")).toHaveAttribute("data-theme", "summer");
	expect(await page.locator("#theme-custom").evaluate((element) => element.textContent)).toBe("");
	await context.close();
});

test("没有主题 cookie 时跟随站点时区的当前季节", async ({ browser }) => {
	const context = await appearanceContext(browser, "light", { blockScripts: true });
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });
	await expect(page.locator("html")).toHaveAttribute("data-theme", seasonNow());
	await context.close();
});

for (const value of ["garbage", encodeURIComponent('{"v":9,"theme":"spring"}')]) {
	test(`非法或过期的主题 cookie 回落为跟随季节：${value}`, async ({ browser }) => {
		const context = await appearanceContext(browser, "light");
		await context.addCookies([{ name: THEME_COOKIE_NAME, value, url: CONTRACT_ORIGIN }]);
		const page = await context.newPage();
		await page.goto("/", { waitUntil: "load" });
		await expect(page.locator("html")).toHaveAttribute("data-theme", seasonNow());
		await context.close();
	});
}

for (const appearance of ["light", "dark"] as const) {
	for (const theme of SEASONS) {
		for (const viewport of VIEWPORTS) {
			test(`工具方言契约：后台 ${theme} / ${appearance} @ ${viewport.width}`, async ({
				browser,
			}) => {
				const context = await appearanceContext(browser, appearance, {
					admin: true,
					theme,
				});
				const page = await context.newPage();
				await page.setViewportSize(viewport);
				await page.goto("/admin", { waitUntil: "load" });
				await expect(page.locator(".dialect-tool")).toBeVisible();
				await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
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
				expect(contrastRatio(scope.primary, scope["primary-foreground"])).toBeGreaterThan(
					10,
				);
				expect(scope.ring.value).toBe(root["brand-8"].value);
				expect(scope.link.value).toBe(root["brand-11"].value);
				expect(scope.selected.value).toBe(root["brand-3"].value);
				for (const token of STATUS_TOKENS) expect(scope[token]).toEqual(root[token]);
				expectReadableText(scope);
				expect(
					await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
				).toBe(true);
				await context.close();
			});
		}
	}

	test(`沉浸方言契约：图库灯箱 ${appearance}，不随主题变化`, async ({ browser }) => {
		test.setTimeout(120_000);
		let previous: ScopeColors | undefined;
		for (const theme of SEASONS) {
			const context = await appearanceContext(browser, appearance, { theme });
			const page = await context.newPage();
			await page.goto("/galleries", { waitUntil: "load" });
			await page.locator('a[href="/galleries/contract-gallery"]').first().click();
			await page.waitForURL("**/galleries/contract-gallery");
			await page.locator("figure button").first().click();
			const immersive = page.locator(".dialect-immersive");
			await expect(immersive).toBeVisible();
			const stage = await scopeColors(page, ".dialect-immersive", FIXED_TOKENS);
			const root = await scopeColors(page, "html");
			expect(stage.background.luminance).toBeLessThan(0.01);
			expect(contrastRatio(stage.primary, stage["primary-foreground"])).toBeGreaterThan(10);
			const stageStatus = await scopeColors(page, ".dialect-immersive", STATUS_TOKENS);
			for (const token of STATUS_TOKENS) expect(stageStatus[token]).toEqual(root[token]);
			if (previous) expect(stage, `${theme} 的沉浸舞台与其他主题一致`).toEqual(previous);
			previous = stage;
			await page.keyboard.press("Escape");
			await expect(immersive).toHaveCount(0);
			const surface = await scopeColors(page, ".dialect-public", ["primary", "brand-9"]);
			expect(surface.primary.value).toBe(surface["brand-9"].value);
			await context.close();
		}
	});
}
