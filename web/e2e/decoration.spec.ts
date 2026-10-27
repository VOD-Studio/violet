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

/** 背景层插画（按季节的 viewBox 区分）与粒子画布。 */
function backdropArt(page: import("@playwright/test").Page) {
	return {
		scene: page.locator("div[class*='backdrop'] svg[class*='scene']"),
		particleCanvas: page.locator("div[class*='backdrop'] canvas[class*='absolute']"),
	};
}

for (const { decoration, expectShown } of [
	{ decoration: "winter" as const, expectShown: true },
	{ decoration: "none" as const, expectShown: false },
]) {
	test(`装饰投放：${expectShown ? "冬季" : "关闭"}时背景层与挂件${expectShown ? "渲染" : "不渲染"}`, async ({
		browser,
	}) => {
		const context = await appearanceContext(browser, "light", { decoration });
		const page = await context.newPage();
		await page.goto("/", { waitUntil: "load" });

		const { scene, particleCanvas } = backdropArt(page);
		const ornaments = page.locator("[class*='ornament']");
		if (expectShown) {
			// 冬季背景层插画的 viewBox 是四季里唯一的 600x430
			await expect(scene).toHaveAttribute("viewBox", "0 0 600 430");
			await expect(particleCanvas).toBeVisible();
			// 顶栏三个胶囊 + 页脚上沿
			await expect(ornaments).toHaveCount(4);
		} else {
			await expect(scene).toHaveCount(0);
			await expect(particleCanvas).toHaveCount(0);
			await expect(ornaments).toHaveCount(0);
		}
		await context.close();
	});
}

test("装饰投放：点缀位随寄语出现在首页底部", async ({ browser }) => {
	const context = await appearanceContext(browser, "light", { decoration: "spring" });
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });
	const vignette = page.locator("main svg[class*='scene'][viewBox='0 0 230 110']");
	await vignette.scrollIntoViewIfNeeded();
	await expect(vignette).toBeVisible();
	await context.close();
});

test("装饰投放：工具方言内挂件隐藏", async ({ browser }) => {
	const context = await appearanceContext(browser, "light", { decoration: "autumn" });
	const page = await context.newPage();
	await page.goto("/inkline", { waitUntil: "load" });
	// 工具方言仍渲染顶栏挂件（3 枚，无页脚），全部被方言钩子隐藏
	await expect(page.locator("[class*='ornament']")).toHaveCount(3);
	const hidden = await page.evaluate(() =>
		Array.from(document.querySelectorAll("[class*='ornament']")).map(
			(el) => getComputedStyle(el).display,
		),
	);
	expect(hidden).toEqual(["none", "none", "none"]);
	await context.close();
});

test("减弱动态时粒子画布静止", async ({ browser }) => {
	const context = await appearanceContext(browser, "light", { decoration: "winter" });
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });
	await page.waitForTimeout(600);
	const { still, hasInk } = await page.evaluate(async () => {
		const canvas = document.querySelector<HTMLCanvasElement>(
			"div[class*='backdrop'] canvas[class*='absolute']",
		);
		if (!canvas) throw new Error("粒子画布未渲染");
		const context = canvas.getContext("2d", { willReadFrequently: true });
		if (!context) throw new Error("不支持 canvas 2d");
		const snap = () => JSON.stringify(Array.from(context.getImageData(0, 0, 120, 120).data));
		const first = snap();
		const { promise, resolve } = Promise.withResolvers<void>();
		setTimeout(resolve, 800);
		await promise;
		return {
			still: first === snap(),
			// 画布上有内容（非全透明），静止的不是空画布
			hasInk: first.replace(/0/g, "").length > 0,
		};
	});
	expect(hasInk, "静止帧有内容").toBe(true);
	expect(still, "两次采样一致").toBe(true);
	await context.close();
});

test("切换装饰偏好后刷新，首帧与切换后一致", async ({ browser }) => {
	const context = await appearanceContext(browser, "light", { decoration: "spring" });
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });

	// 顶栏主题菜单 → 季节装饰子菜单 → 无；工具区默认收起，悬停用户槽位后展开
	const header = page.locator("header").first();
	await header.getByRole("link", { name: "登录", exact: true }).hover();
	await header.getByRole("button", { name: /^主题：/ }).click();
	await page.getByRole("menuitem").filter({ hasText: "季节装饰" }).hover();
	const noneOption = page.getByRole("menuitemradio", { name: /^无/ });
	await expect(noneOption).toBeVisible();
	await noneOption.click();

	await expect(page.locator("html")).toHaveAttribute("data-decoration", "none");
	await expect(page.locator("[class*='ornament']")).toHaveCount(0);
	await expect(backdropArt(page).scene).toHaveCount(0);

	// 刷新：SSR 依据 cookie 输出同一首帧
	await page.reload({ waitUntil: "load" });
	await expect(page.locator("html"), "刷新后首帧保持关闭").toHaveAttribute(
		"data-decoration",
		"none",
	);
	await expect(page.locator("[class*='ornament']")).toHaveCount(0);

	// 再选回一季，刷新后首帧恢复冬季装饰
	await header.getByRole("link", { name: "登录", exact: true }).hover();
	await header.getByRole("button", { name: /^主题：/ }).click();
	await page.getByRole("menuitem").filter({ hasText: "季节装饰" }).hover();
	const winterOption = page.getByRole("menuitemradio", { name: /^冬 12/ });
	await expect(winterOption).toBeVisible();
	await winterOption.click();
	await expect(page.locator("html")).toHaveAttribute("data-decoration", "winter");
	await page.reload({ waitUntil: "load" });
	await expect(page.locator("html"), "刷新后首帧恢复冬季").toHaveAttribute(
		"data-decoration",
		"winter",
	);
	await expect(backdropArt(page).scene).toHaveAttribute("viewBox", "0 0 600 430");
	await context.close();
});
