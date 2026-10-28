import { expect, type Page, test } from "@playwright/test";
import { normalizeTheme } from "@violetjs/theme";
import {
	DECORATION_LAYERS_COOKIE_NAME,
	type DecorationPreference,
} from "../src/shared/lib/decoration-preference";
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

async function openDecorationMenu(page: Page) {
	const header = page.locator("header").first();
	await header.getByRole("link", { name: "登录", exact: true }).hover();
	await header.getByRole("button", { name: /^主题：/ }).click();
	await page.getByRole("menuitem").filter({ hasText: "季节装饰" }).hover();
	const menu = page.getByRole("menu", { name: /季节装饰/ });
	await expect(menu).toBeVisible();
	const entry = await menu.getByRole("menuitemradio").first().boundingBox();
	if (!entry) throw new Error("装饰子菜单没有可用选项");
	// Radix 依赖父菜单内的指针方向；连续移动避免跨 Portal 直跳被当作离开。
	await page.mouse.move(entry.x + entry.width / 2, entry.y + entry.height / 2, { steps: 8 });
	return menu;
}

for (const appearance of ["light", "dark"] as const) {
	for (const decoration of ["spring", "summer", "autumn", "winter"] as const) {
		test(`三类插槽：${appearance} ${decoration} 不改变正文和页脚位置`, async ({ browser }) => {
			const context = await appearanceContext(browser, appearance, { decoration });
			const page = await context.newPage();
			await page.setViewportSize({ width: 1440, height: 900 });
			await page.goto("/", { waitUntil: "load" });
			await expect(page.locator("[data-season-backdrop]")).toHaveAttribute(
				"data-season-backdrop",
				decoration,
			);
			await expect(page.locator("[data-season-particles]")).toBeVisible();
			await expect(page.locator("[data-decoration-slot='accent'] svg")).toBeVisible();
			await expect(page.locator("header [data-season-ornament]")).toHaveCount(3);
			const menu = await openDecorationMenu(page);
			await page.evaluate(() => document.fonts.ready);
			const titleBefore = await page.locator("main h1").first().boundingBox();
			const footerBefore = await page.locator("footer").boundingBox();
			const slots = await page.locator("[data-decoration-slot]").evaluateAll((nodes) =>
				nodes.map((node) => ({
					hidden: node.getAttribute("aria-hidden"),
					pointerEvents: getComputedStyle(node).pointerEvents,
				})),
			);
			for (const slot of slots)
				expect(slot).toEqual({ hidden: "true", pointerEvents: "none" });

			await menu.getByRole("menuitemradio", { name: /^无/ }).click();
			await expect(page.locator("html")).toHaveAttribute("data-decoration", "none");
			await expect(page.locator("[data-decoration-slot]")).toHaveCount(0);
			expect(await page.locator("main h1").first().boundingBox()).toEqual(titleBefore);
			expect(await page.locator("footer").boundingBox()).toEqual(footerBefore);
			await context.close();
		});
	}
}

test("SSR 首帧按图层开关卸载插画与粒子，不留下空背景", async ({ browser }) => {
	const context = await appearanceContext(browser, "light", {
		blockScripts: true,
		decoration: "winter",
		decorationLayers: { illustration: false, particles: false, ornaments: true },
	});
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });
	await expect(page.locator("html")).toHaveAttribute("data-decoration-layers", "ornaments");
	await expect(page.locator("[data-season-backdrop]")).toHaveCount(0);
	await expect(page.locator("[data-decoration-slot='accent']")).toHaveCount(0);
	await expect(page.locator("header [data-season-ornament]")).toHaveCount(3);
	await context.close();
});

test("工具页面不显示装饰", async ({ browser }) => {
	const context = await appearanceContext(browser, "light", { decoration: "autumn" });
	const page = await context.newPage();
	await page.goto("/inkline", { waitUntil: "load" });
	const shown = await page.locator("[data-decoration-slot]").evaluateAll(
		(nodes) =>
			nodes.filter((node) => {
				const style = getComputedStyle(node);
				return (
					style.display !== "none" &&
					style.visibility !== "hidden" &&
					node.getClientRects().length
				);
			}).length,
	);
	expect(shown).toBe(0);
	await context.close();
});

test("减弱动态时粒子有静态画面且不持续重绘", async ({ browser }) => {
	const context = await appearanceContext(browser, "light", { decoration: "winter" });
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });
	await expect(page.locator("[data-season-particles]")).toBeVisible();
	await page.waitForTimeout(300);
	const { still, hasInk } = await page.evaluate(async () => {
		const canvas = document.querySelector<HTMLCanvasElement>("[data-season-particles]");
		if (!canvas) throw new Error("粒子画布未渲染");
		const context = canvas.getContext("2d", { willReadFrequently: true });
		if (!context) throw new Error("不支持 canvas 2d");
		const first = context.getImageData(0, 0, canvas.width, canvas.height).data;
		const { promise, resolve } = Promise.withResolvers<void>();
		setTimeout(resolve, 400);
		await promise;
		const second = context.getImageData(0, 0, canvas.width, canvas.height).data;
		return {
			still: first.every((value, index) => value === second[index]),
			hasInk: first.some((value, index) => index % 4 === 3 && value > 0),
		};
	});
	expect(hasInk, "静止帧有内容").toBe(true);
	expect(still, "两次采样一致").toBe(true);
	await context.close();
});

test("延迟 CookieStore 时连续关闭图层，刷新禁用脚本仍保持全部关闭", async ({ browser }) => {
	const context = await appearanceContext(browser, "light", { decoration: "winter" });
	await context.addInitScript(() => {
		const state = window as typeof window & { layerWritesFinished: number };
		state.layerWritesFinished = 0;
		const original = cookieStore.set.bind(cookieStore);
		let started = 0;
		cookieStore.set = async (...args: [string, string] | [CookieInit]) => {
			if (args.length === 2) return original(...args);
			const [options] = args;
			if (options.name !== "decoration-layers") return original(options);
			const { promise, resolve } = Promise.withResolvers<void>();
			setTimeout(resolve, ++started === 1 ? 250 : 10);
			await promise;
			await original(options);
			state.layerWritesFinished += 1;
		};
	});
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });
	const menu = await openDecorationMenu(page);
	for (const name of ["插画", "飘落", "挂件"]) {
		await menu.getByRole("menuitemcheckbox", { name, exact: true }).click();
		await expect(menu).toBeVisible();
	}
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					(window as typeof window & { layerWritesFinished: number }).layerWritesFinished,
			),
		)
		.toBe(3);
	expect(
		(await context.cookies()).find((cookie) => cookie.name === DECORATION_LAYERS_COOKIE_NAME)
			?.value,
	).toBe("none");
	await expect(page.locator("html")).toHaveAttribute("data-decoration-layers", "none");
	await expect(page.locator("[data-decoration-slot]")).toHaveCount(0);
	await page.keyboard.press("Escape");
	await expect(menu).toBeHidden();
	await context.route("**/*", (route) =>
		["script", "fetch", "xhr"].includes(route.request().resourceType())
			? route.abort()
			: route.fallback(),
	);
	await page.reload({ waitUntil: "load" });
	await expect(page.locator("html")).toHaveAttribute("data-decoration", "winter");
	await expect(page.locator("html")).toHaveAttribute("data-decoration-layers", "none");
	await expect(page.locator("[data-decoration-slot]")).toHaveCount(0);
	await context.close();
});

test("移动端季节与图层可独立配置并持久化", async ({ browser }) => {
	const context = await appearanceContext(browser, "dark", {
		theme: "winter",
		decoration: "winter",
	});
	const page = await context.newPage();
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/", { waitUntil: "load" });
	await page.getByRole("button", { name: "展开全部导航", exact: true }).click();
	const group = page.getByRole("radiogroup", { name: "装饰", exact: true });
	await group.getByRole("radio", { name: /^春(?:\s|$)/ }).click();
	await page.getByRole("checkbox", { name: "飘落", exact: true }).click();
	await page.getByRole("checkbox", { name: "挂件", exact: true }).click();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "winter");
	await expect(page.locator("html")).toHaveAttribute("data-decoration", "spring");
	await expect(page.locator("html")).toHaveAttribute("data-decoration-layers", "illustration");
	await page.reload({ waitUntil: "load" });
	await expect(page.locator("html")).toHaveAttribute("data-decoration", "spring");
	await expect(page.locator("html")).toHaveAttribute("data-decoration-layers", "illustration");
	await expect(page.locator("[data-season-particles]")).toHaveCount(0);
	await expect(page.locator("[data-season-ornament]")).toHaveCount(0);
	await expect(page.locator("[data-season-backdrop]")).toBeHidden();
	await context.close();
});

test("指定装饰不随主题变化，恢复跟随后与主题一致", async ({ browser }) => {
	const context = await appearanceContext(browser, "light", {
		theme: "spring",
		decoration: "winter",
	});
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });
	const header = page.locator("header").first();
	await header.getByRole("link", { name: "登录", exact: true }).hover();
	await header.getByRole("button", { name: /^主题：/ }).click();
	await page.getByRole("menuitemradio", { name: /^夏(?:\s|$)/ }).click();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "summer");
	await expect(page.locator("html")).toHaveAttribute("data-decoration", "winter");
	await expect(page.getByRole("menu")).toBeHidden();
	const menu = await openDecorationMenu(page);
	await menu.getByRole("menuitemradio", { name: /^跟随主题/ }).click();
	await expect(page.locator("html")).toHaveAttribute("data-decoration", "summer");
	await page.reload({ waitUntil: "load" });
	await expect(page.locator("html")).toHaveAttribute("data-decoration", "summer");
	await context.close();
});

test("命令面板切换装饰不改变主题", async ({ browser }) => {
	const context = await appearanceContext(browser, "light", {
		theme: "summer",
		decoration: "spring",
	});
	const page = await context.newPage();
	await page.goto("/", { waitUntil: "load" });
	const header = page.locator("header").first();
	await header.getByRole("link", { name: "登录", exact: true }).hover();
	await header.getByRole("button", { name: /^搜索/ }).click();
	const dialog = page.getByRole("dialog");
	await dialog.getByRole("textbox").fill("装饰");
	await dialog.getByRole("button", { name: "装饰：无", exact: true }).click();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "summer");
	await expect(page.locator("html")).toHaveAttribute("data-decoration", "none");
	await expect(page.locator("[data-decoration-slot]")).toHaveCount(0);
	await page.reload({ waitUntil: "load" });
	await expect(page.locator("html")).toHaveAttribute("data-decoration", "none");
	await context.close();
});
