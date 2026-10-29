import { expect, type Locator, type Page, test } from "@playwright/test";
import { generateScales, normalizeTheme } from "@violetjs/theme";
import {
	parseCustomThemeCookie,
	parseThemeCookie,
	resolvePresetTheme,
} from "../src/shared/lib/theme-preference";
import { appearanceContext, canonicalColor } from "./theme-harness";

const cookieHeader = async (page: Page) =>
	(await page.context().cookies()).map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");

/** 顶栏工具区默认收起，悬停用户槽位后展开。 */
async function openThemeMenu(page: Page) {
	const header = page.locator("header").first();
	await header.getByRole("link", { name: "登录", exact: true }).hover();
	await header.getByRole("button", { name: /^主题：/ }).click();
	await expect(page.getByRole("menu")).toBeVisible();
}

test("切换主题后即时生效，刷新与再次访问后保持", async ({ browser }) => {
	const context = await appearanceContext(browser, "light");
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });
	const season = resolvePresetTheme("follow", new Date());
	await expect(page.locator("html")).toHaveAttribute("data-theme", season);

	const target = season === "winter" ? "spring" : "winter";
	const title = target === "winter" ? "冬 · 初雪" : "春 · 花朝";
	await openThemeMenu(page);
	await page.getByRole("menuitemradio", { name: new RegExp(title) }).click();
	await expect(page.locator("html")).toHaveAttribute("data-theme", target);
	await expect
		.poll(async () =>
			parseThemeCookie(
				(await context.cookies())
					.map((cookie) => `${cookie.name}=${cookie.value}`)
					.join("; "),
			),
		)
		.toBe(target);
	await expect(
		page
			.locator("header")
			.first()
			.getByRole("button", { name: `主题：${title}` }),
	).toBeAttached();

	await page.reload({ waitUntil: "load" });
	await expect(page.locator("html")).toHaveAttribute("data-theme", target);
	const revisit = await context.newPage();
	await revisit.goto("/", { waitUntil: "load" });
	await expect(revisit.locator("html"), "再次访问仍是所选主题").toHaveAttribute(
		"data-theme",
		target,
	);
	await revisit.close();
	await openThemeMenu(page);
	await expect(page.getByRole("menuitemradio", { name: new RegExp(title) })).toHaveAttribute(
		"aria-checked",
		"true",
	);

	await page.getByRole("menuitemradio", { name: /跟随季节/ }).click();
	await expect(page.locator("html")).toHaveAttribute("data-theme", season);
	await page.reload({ waitUntil: "load" });
	await expect(page.locator("html")).toHaveAttribute("data-theme", season);
	await expect(
		page
			.locator("header")
			.first()
			.getByRole("button", { name: /^主题：跟随季节/ }),
	).toBeAttached();
	await context.close();
});

test("键盘可以 Tab 到主题菜单并选择季节", async ({ browser }) => {
	const context = await appearanceContext(browser, "dark");
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });
	const season = resolvePresetTheme("follow", new Date());
	const target = season === "summer" ? "autumn" : "summer";
	const title = target === "summer" ? "夏 · 荷风" : "秋 · 桂月";

	// 从工具区第一个按钮开始 Tab，工具区须随键盘聚焦展开
	const header = page.locator("header").first();
	const trigger = header.getByRole("button", { name: /^主题：/ });
	await header.getByRole("button", { name: "搜索 (⌘K)" }).focus();
	for (let step = 0; step < 6; step++) {
		if (await trigger.evaluate((element) => element === document.activeElement)) break;
		await page.keyboard.press("Tab");
	}
	await expect(trigger).toBeFocused();
	await expect
		.poll(() =>
			trigger.evaluate(
				(element) => getComputedStyle(element.parentElement as Element).opacity,
			),
		)
		.toBe("1");
	await page.keyboard.press("Enter");
	const menu = page.getByRole("menu");
	await expect(menu).toBeVisible();
	await expect(page.getByRole("menuitemradio", { name: /跟随季节/ })).toHaveAttribute(
		"aria-checked",
		"true",
	);
	// 菜单项依次为跟随季节、春、夏、秋、冬；键盘打开时焦点落在第一项
	const items = page.getByRole("menuitemradio");
	const index = ["follow", "spring", "summer", "autumn", "winter"].indexOf(target);
	await expect(items.nth(0)).toBeFocused();
	for (let step = 1; step <= index; step++) {
		await page.keyboard.press("ArrowDown");
		await expect(items.nth(step)).toBeFocused();
	}
	await expect(items.nth(index)).toHaveAccessibleName(new RegExp(title));
	await page.keyboard.press("Enter");
	await expect(page.locator("html")).toHaveAttribute("data-theme", target);
	await expect(menu).toBeHidden();
	await context.close();
});

test("移动端导航面板可以选择主题", async ({ browser }) => {
	const context = await appearanceContext(browser, "light");
	const page = await context.newPage();
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/", { waitUntil: "load" });
	const season = resolvePresetTheme("follow", new Date());
	const target = season === "spring" ? "summer" : "spring";
	const title = target === "spring" ? "春 · 花朝" : "夏 · 荷风";

	await page
		.getByRole("button", { name: /展开全部导航$/ })
		.first()
		.click();
	const option = page
		.getByRole("radiogroup", { name: "主题" })
		.getByRole("radio", { name: title });
	await option.click();
	await expect(page.locator("html")).toHaveAttribute("data-theme", target);
	await expect(option).toHaveAttribute("aria-checked", "true");
	await page.reload({ waitUntil: "load" });
	await expect(page.locator("html")).toHaveAttribute("data-theme", target);

	await page
		.getByRole("button", { name: /展开全部导航$/ })
		.first()
		.click();
	await page.getByRole("radio", { name: "自定义主题" }).click();
	await expect(page.getByRole("dialog", { name: "自定义主题" })).toBeVisible();
	await context.close();
});

test("自定义主题：实时预览，应用后刷新仍生效，选回预设即清除", async ({ browser }) => {
	const context = await appearanceContext(browser, "light");
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });
	const season = resolvePresetTheme("follow", new Date());

	await openThemeMenu(page);
	await page.getByRole("menuitemradio", { name: /自定义/ }).click();
	const dialog = page.getByRole("dialog", { name: "自定义主题" });
	await expect(dialog).toBeVisible();
	const input = dialog.getByLabel("种子色", { exact: true });
	await input.fill("#12");
	await expect(dialog.getByRole("button", { name: "应用" })).toBeDisabled();

	await input.fill("#2B6CB0");
	const expected = normalizeTheme({ version: 1, seed: "#2b6cb0" });
	const { brand } = generateScales(expected, { appearance: "light" });
	// 浅色预览卡：主要按钮取实色档，链接取文字档，选中态取浅底档
	const preview = dialog.getByRole("group", { name: "生成结果预览" });
	const computed = (target: Locator, property: "color" | "backgroundColor") =>
		target.first().evaluate((element, key) => getComputedStyle(element)[key], property);
	await expect
		.poll(() => computed(preview.getByRole("button", { name: "主要按钮" }), "backgroundColor"))
		.toBe(await canonicalColor(page, brand.steps[9]));
	expect(await computed(preview.getByText("链接", { exact: true }), "color")).toBe(
		await canonicalColor(page, brand.steps[11]),
	);
	expect(await computed(preview.getByText("已选中", { exact: true }), "backgroundColor")).toBe(
		await canonicalColor(page, brand.steps[3]),
	);

	await dialog.getByRole("button", { name: "应用" }).click();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "custom");
	await expect
		.poll(async () => parseCustomThemeCookie(await cookieHeader(page)))
		.toEqual(expected);

	await page.reload({ waitUntil: "load" });
	await expect(page.locator("html")).toHaveAttribute("data-theme", "custom");
	await expect(
		page.locator("header").first().getByRole("button", { name: "主题：自定义 #2b6cb0" }),
	).toBeAttached();
	await openThemeMenu(page);
	await expect(page.getByRole("menuitemradio", { name: /自定义/ })).toHaveAttribute(
		"aria-checked",
		"true",
	);
	await page.getByRole("menuitemradio", { name: /跟随季节/ }).click();
	await expect(page.locator("html")).toHaveAttribute("data-theme", season);
	await expect.poll(async () => parseCustomThemeCookie(await cookieHeader(page))).toBeNull();
	expect(parseThemeCookie(await cookieHeader(page))).toBe("follow");
	await context.close();
});
