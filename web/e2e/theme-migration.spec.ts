import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { appearanceContext, contrastRatio, scopeColors } from "./theme-harness";

for (const appearance of ["light", "dark"] as const) {
	test(`人设身份色独立于品牌并满足文字与边界门槛 ${appearance}`, async ({ browser }) => {
		const context = await appearanceContext(browser, appearance);
		const page = await context.newPage();
		await page.goto("/chat/personas");
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
}
