import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { appearanceContext, contrastRatio, type ScopeColors, scopeColors } from "./theme-harness";

const THEMES = ["violet", "coral"] as const;
const DIALECTS = ["public", "tool", "immersive"] as const;
const FIXED_TOKENS = [
	"background",
	"foreground",
	"card",
	"primary",
	"primary-hover",
	"primary-foreground",
	"link",
	"selected",
	"ring",
	"input",
	"edge-hairline",
	"surface-glass",
];

for (const appearance of ["light", "dark"] as const) {
	test(`生成色阶：主题、方言、按钮悬停与提高对比度 ${appearance}`, async ({ browser }) => {
		test.setTimeout(90_000);
		const context = await appearanceContext(browser, appearance);
		const page = await context.newPage();
		await page.goto("/", { waitUntil: "load" });
		await page.evaluate(() => {
			const fixture = document.createElement("aside");
			fixture.id = "theme-contract";
			for (const dialect of ["public", "tool", "immersive"]) {
				const section = document.createElement("section");
				section.className = `dialect-${dialect}`;
				section.dataset.dialect = dialect;
				section.style.padding = "16px";
				for (const variant of ["default", "primary", "destructive"]) {
					const button = document.createElement("button");
					button.className = `v-button v-button--${variant}`;
					button.textContent = `${dialect} ${variant}`;
					section.append(button);
				}
				fixture.append(section);
			}
			document.body.append(fixture);
		});
		const standardLink = new Map<string, number>();
		for (const contrast of ["no-preference", "more"] as const) {
			await page.emulateMedia({ contrast });
			let fixed: ScopeColors | undefined;
			for (const theme of THEMES) {
				await page.addStyleTag({
					content: readFileSync(
						join(
							import.meta.dirname,
							`../packages/ui/src/styles/palettes/${theme}.generated.css`,
						),
						"utf8",
					),
				});
				const root = await scopeColors(page, "html");
				for (const dialect of DIALECTS) {
					const selector = `#theme-contract [data-dialect="${dialect}"]`;
					const colors = await scopeColors(page, selector);
					for (const status of ["destructive", "warning", "success"]) {
						expect(colors[status]).toEqual(root[status]);
						expect(colors[`${status}-foreground`]).toEqual(
							root[`${status}-foreground`],
						);
						expect(
							contrastRatio(colors[status], colors[`${status}-foreground`]),
						).toBeGreaterThanOrEqual(4.5);
						if (dialect !== "immersive") {
							for (const background of ["background", "card"])
								expect(
									contrastRatio(colors[`${status}-text`], colors[background]),
								).toBeGreaterThanOrEqual(4.5);
						}
					}
					expect(
						contrastRatio(colors.foreground, colors.background),
					).toBeGreaterThanOrEqual(4.5);
					expect(
						contrastRatio(colors["muted-foreground"], colors.card),
					).toBeGreaterThanOrEqual(4.5);
					expect(contrastRatio(colors.link, colors.background)).toBeGreaterThanOrEqual(
						4.5,
					);
					expect(
						contrastRatio(colors["selected-foreground"], colors.selected),
					).toBeGreaterThanOrEqual(4.5);
					expect(contrastRatio(colors.input, colors.background)).toBeGreaterThanOrEqual(
						3,
					);
					expect(contrastRatio(colors.ring, colors.background)).toBeGreaterThanOrEqual(3);
					const key = `${theme}:${dialect}`;
					const linkRatio = contrastRatio(colors.link, colors.background);
					if (contrast === "no-preference") standardLink.set(key, linkRatio);
					else expect(linkRatio).toBeGreaterThan(standardLink.get(key) ?? 0);
					for (const variant of ["default", "primary", "destructive"]) {
						const role = variant === "destructive" ? "destructive" : "primary";
						const button = page.locator(`${selector} .v-button--${variant}`);
						await page.mouse.move(0, 0);
						await expect
							.poll(() =>
								button.evaluate((el) => getComputedStyle(el).backgroundColor),
							)
							.toBe(colors[role].value);
						const normal = contrastRatio(colors[`${role}-foreground`], colors[role]);
						await button.hover();
						await expect
							.poll(() =>
								button.evaluate((el) => getComputedStyle(el).backgroundColor),
							)
							.toBe(colors[`${role}-hover`].value);
						expect(await button.evaluate((el) => getComputedStyle(el).color)).toBe(
							colors[`${role}-foreground`].value,
						);
						expect(normal).toBeGreaterThanOrEqual(4.5);
						expect(
							contrastRatio(colors[`${role}-foreground`], colors[`${role}-hover`]),
						).toBeGreaterThanOrEqual(normal);
					}
					const categories = await scopeColors(page, selector, [
						"category-1-9",
						"category-2-9",
						"category-3-9",
						"category-4-9",
						"category-5-9",
					]);
					for (let index = 1; index <= 5; index++)
						expect(colors[`chart-${index}`]).toEqual(categories[`category-${index}-9`]);
					expect(colors["edge-hairline"].alpha).toBeGreaterThan(0);
					expect(colors["edge-hairline"].alpha).toBeLessThan(1);
					expect(colors["surface-glass"].alpha).toBeGreaterThan(0);
					expect(colors["surface-glass"].alpha).toBeLessThan(1);
				}
				const stage = await scopeColors(
					page,
					'#theme-contract [data-dialect="immersive"]',
					FIXED_TOKENS,
				);
				if (fixed) expect(stage, "沉浸舞台不随主题变化").toEqual(fixed);
				fixed = stage;
				await page.evaluate(() => document.documentElement.classList.toggle("dark"));
				expect(
					await scopeColors(
						page,
						'#theme-contract [data-dialect="immersive"]',
						FIXED_TOKENS,
					),
					"沉浸舞台不随明暗变化",
				).toEqual(stage);
				await page.evaluate(() => document.documentElement.classList.toggle("dark"));
			}
		}
		await context.close();
	});
}
