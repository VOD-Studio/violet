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
async function openThemePanel(page: Page) {
	const header = page.locator("header").first();
	await header.getByRole("link", { name: "登录", exact: true }).hover();
	await header.getByRole("button", { name: /^主题：/ }).click();
	await expect(page.getByRole("dialog", { name: "主题与装饰", exact: true })).toBeVisible();
}

test("切换主题后即时生效，刷新与再次访问后保持", async ({ browser }) => {
	const context = await appearanceContext(browser, "light");
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });
	const season = resolvePresetTheme("follow", new Date());
	await expect(page.locator("html")).toHaveAttribute("data-theme", season);

	const target = season === "winter" ? "spring" : "winter";
	const title = target === "winter" ? "冬 · 初雪" : "春 · 花朝";
	await openThemePanel(page);
	await page
		.getByRole("radiogroup", { name: "主题", exact: true })
		.getByRole("radio", { name: title, exact: true })
		.click();
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
	await openThemePanel(page);
	await expect(
		page
			.getByRole("radiogroup", { name: "主题", exact: true })
			.getByRole("radio", { name: title, exact: true }),
	).toHaveAttribute("aria-checked", "true");

	await page.getByRole("radio", { name: "跟随季节", exact: true }).click();
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

test("键盘可打开设置并切换主题，Escape 关闭后焦点回到入口", async ({ browser }) => {
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
	const panel = page.getByRole("dialog", { name: "主题与装饰", exact: true });
	await expect(panel).toBeVisible();
	const group = panel.getByRole("radiogroup", { name: "主题", exact: true });
	const current = group.getByRole("radio", { name: "跟随季节", exact: true });
	await expect(current).toHaveAttribute("aria-checked", "true");
	for (let step = 0; step < 6; step++) {
		if (await current.evaluate((element) => element === document.activeElement)) break;
		await page.keyboard.press("Tab");
	}
	await expect(current).toBeFocused();
	const option = group.getByRole("radio", { name: title, exact: true });
	for (let step = 0; step < 5; step++) {
		if (await option.evaluate((element) => element === document.activeElement)) break;
		await page.keyboard.press("ArrowRight");
	}
	await expect(option).toBeFocused();
	await page.keyboard.press("Space");
	await expect(page.locator("html")).toHaveAttribute("data-theme", target);
	await expect(option).toHaveAttribute("aria-checked", "true");
	await expect(panel).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(panel).toBeHidden();
	await expect(trigger).toBeFocused();
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
	await page.getByRole("button", { name: "自定义主题", exact: true }).click();
	await expect(page.getByRole("dialog", { name: "自定义主题" })).toBeVisible();
	await context.close();
});

test("自定义主题：实时预览，应用后刷新仍生效，选回预设即清除", async ({ browser }) => {
	const context = await appearanceContext(browser, "light");
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });
	const season = resolvePresetTheme("follow", new Date());

	await openThemePanel(page);
	await page.getByRole("button", { name: "自定义主题", exact: true }).click();
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
	await openThemePanel(page);
	await expect(page.getByRole("button", { name: "自定义主题", exact: true })).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await page.getByRole("radio", { name: "跟随季节", exact: true }).click();
	await expect(page.locator("html")).toHaveAttribute("data-theme", season);
	await expect.poll(async () => parseCustomThemeCookie(await cookieHeader(page))).toBeNull();
	expect(parseThemeCookie(await cookieHeader(page))).toBe("follow");
	await context.close();
});
