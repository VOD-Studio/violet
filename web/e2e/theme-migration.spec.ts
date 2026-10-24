import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { appearanceContext, contrastRatio, scopeColors } from "./theme-harness";

for (const appearance of ["light", "dark"] as const) {
	test(`lab 页面与 portal 保留局部色板，离开不泄漏 ${appearance}`, async ({ browser }) => {
		const context = await appearanceContext(browser, appearance);
		const page = await context.newPage();
		await page.setViewportSize({ width: 900, height: 900 });
		await page.goto("/");
		const publicColors = await scopeColors(page, ".dialect-public");
		await page.goto("/lab/mascot");
		const scope = page.locator("[data-lab-scope]").first();
		await expect(scope).toBeVisible();
		const lab = await scopeColors(page, "[data-lab-scope]", [
			"primary-base",
			"decoration",
			"neon-blue",
		]);
		expect(lab.decoration).toEqual(lab["primary-base"]);
		const reference =
			appearance === "light" ? "oklch(0.53 0.205 286)" : "oklch(0.72 0.148 286)";
		const expected = await scope.evaluate((element, value) => {
			const probe = document.createElement("span");
			probe.style.color = value;
			element.append(probe);
			const color = getComputedStyle(probe).color;
			probe.remove();
			return color;
		}, reference);
		expect(lab["primary-base"].value).toBe(expected);
		await expect(async () => {
			await page.getByRole("button", { name: "全部状态", exact: true }).click();
			await expect(page.getByRole("dialog", { name: "状态图鉴" })).toBeVisible();
		}).toPass();
		const dialog = page.getByRole("dialog", { name: "状态图鉴" });
		expect(
			await scopeColors(page, '[role="dialog"]', ["primary-base", "decoration", "neon-blue"]),
		).toEqual(lab);
		await dialog.getByRole("searchbox", { name: "搜索表情、状态或编号" }).focus();
		await expect(dialog.getByRole("searchbox", { name: "搜索表情、状态或编号" })).toBeFocused();
		await page.keyboard.press("Escape");
		await expect(dialog).not.toBeVisible();
		const documentId = await page.evaluate(() => {
			document.documentElement.dataset.themeNavigation = "same-document";
			return document.documentElement.dataset.themeNavigation;
		});
		await page
			.getByRole("contentinfo")
			.getByRole("link", { name: "Violet", exact: true })
			.click();
		await expect(page).toHaveURL(/\/$/);
		expect(await page.locator("html").getAttribute("data-theme-navigation")).toBe(documentId);
		expect(await scopeColors(page, ".dialect-public")).toEqual(publicColors);
		await expect(page.locator(".lab-scope")).toHaveCount(0);
		await context.close();
	});

	test(`人设身份色独立于品牌并满足文字与边界门槛 ${appearance}`, async ({ browser }) => {
		const context = await appearanceContext(browser, appearance);
		const page = await context.newPage();
		await page.goto("/persona");
		await expect(page.locator("main.identity-theme")).toBeVisible();
		for (const contrast of ["no-preference", "more"] as const) {
			await page.emulateMedia({ contrast });
			const colors = await scopeColors(page, "main.identity-theme", [
				"identity-text",
				"identity-surface",
				"identity-border",
				"background",
			]);
			expect(
				contrastRatio(colors["identity-text"], colors.background),
			).toBeGreaterThanOrEqual(4.5);
			expect(
				contrastRatio(colors["identity-text"], colors["identity-surface"]),
			).toBeGreaterThanOrEqual(4.5);
			expect(
				contrastRatio(colors["identity-border"], colors.background),
			).toBeGreaterThanOrEqual(3);
			await page.addStyleTag({
				content: readFileSync(
					join(
						import.meta.dirname,
						"../packages/ui/src/styles/palettes/coral.generated.css",
					),
					"utf8",
				),
			});
			const changed = await scopeColors(page, "main.identity-theme", [
				"identity-text",
				"identity-surface",
				"identity-border",
			]);
			for (const name of ["identity-text", "identity-surface", "identity-border"])
				expect(changed[name]).toEqual(colors[name]);
		}
		await context.close();
	});

	test(`自定义光标的品牌色与悬停混色实际生效 ${appearance}`, async ({ browser }) => {
		const context = await appearanceContext(browser, appearance);
		const page = await context.newPage();
		await page.goto("/");
		const cursor = page.locator('[aria-hidden][style*="mix-blend-mode: difference"]');
		await expect(cursor).toHaveCount(1);
		const brand = await scopeColors(page, "html", ["decoration"]);
		await page.mouse.move(5, 5);
		await expect
			.poll(() => cursor.evaluate((element) => getComputedStyle(element).backgroundColor))
			.toBe(brand.decoration.value);
		const hoverColor = await page.evaluate(() => {
			const button = document.createElement("button");
			button.id = "magnetic-contract";
			button.dataset.cursor = "magnetic";
			button.textContent = "磁性按钮";
			button.style.cssText = "position:fixed;left:150px;top:150px;z-index:9999";
			document.body.append(button);
			const probe = document.createElement("span");
			probe.style.color = "color-mix(in oklab, var(--decoration) 50%, transparent)";
			document.body.append(probe);
			const value = getComputedStyle(probe).color;
			probe.remove();
			return value;
		});
		await page.locator("#magnetic-contract").hover();
		await expect
			.poll(() => cursor.evaluate((element) => getComputedStyle(element).backgroundColor))
			.toBe(hoverColor);
		await context.close();
	});
}
