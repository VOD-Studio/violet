import { expect, test } from "@playwright/test";
import { normalizeTheme } from "@violetjs/theme";
import type { DecorationPreference } from "../src/shared/lib/decoration-preference";
import { resolvePresetTheme, type ThemePreference } from "../src/shared/lib/theme-preference";
import { appearanceContext, CONTRACT_ORIGIN } from "./theme-harness";

const season = resolvePresetTheme("follow", new Date());
const custom = normalizeTheme({ version: 1, seed: "#2b6cb0" });

const CASES: {
	name: string;
	theme?: ThemePreference;
	custom?: typeof custom;
	decoration?: DecorationPreference;
	expected: string;
}[] = [
	{ name: "默认跟随主题，投放当季装饰", expected: season },
	{ name: "跟随主题时随所选预设", theme: "summer", expected: "summer" },
	{ name: "关闭装饰", theme: "summer", decoration: "none", expected: "none" },
	{ name: "自定义主题默认不显示装饰", custom, expected: "none" },
	{ name: "自定义主题另选一季装饰", custom, decoration: "winter", expected: "winter" },
	{ name: "预设主题另选一季装饰", theme: "spring", decoration: "autumn", expected: "autumn" },
];

for (const { name, expected, ...options } of CASES) {
	test(`装饰首帧：${name}`, async ({ browser }) => {
		const firstContext = await appearanceContext(browser, "light", {
			blockScripts: true,
			...options,
		});
		const firstPage = await firstContext.newPage();
		await firstPage.goto("/", { waitUntil: "load" });
		await expect(firstPage.locator("html")).toHaveAttribute("data-decoration", expected);
		await firstContext.close();

		const context = await appearanceContext(browser, "light", options);
		const page = await context.newPage();
		const hydrationErrors: string[] = [];
		page.on("pageerror", (error) => {
			if (/hydration|hydrated|React error #418/i.test(error.message))
				hydrationErrors.push(error.message);
		});
		await page.goto("/", { waitUntil: "load" });
		await expect(page.locator("html"), "水合后保持首帧装饰").toHaveAttribute(
			"data-decoration",
			expected,
		);
		expect(hydrationErrors, "水合不报错").toEqual([]);
		await context.close();
	});
}

test("非法的装饰 cookie 回落为跟随主题", async ({ browser }) => {
	const context = await appearanceContext(browser, "light", {
		blockScripts: true,
		theme: "winter",
	});
	await context.addCookies([
		{ name: "decoration-preference", value: "sakura", url: CONTRACT_ORIGIN },
	]);
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });
	await expect(page.locator("html")).toHaveAttribute("data-decoration", "winter");
	await context.close();
});
