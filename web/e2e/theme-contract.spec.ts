/**
 * 全站视觉主题契约（PRD-0026 / issue #321）。
 *
 * 永久的薄真实浏览器契约：不读 CSS 源文本、不做整页像素快照，
 * 只断言真实 Chromium 中计算后的 semantic token 与主题首帧行为。
 *
 * 覆盖矩阵：light / dark / system × 390×844 / 1440×900。
 * 每个场景两段验证：
 * - 首帧（阻断 JS bundle 加载，仅保留 SSR HTML + 内联主题脚本 + 静态资源）：
 *   校验 <html> class、画布背景与首页 scoped accent，即 hydration 前状态；
 * - hydration 后（放行 JS，浏览器侧 /api/** 由 mock-data.mjs 同一份数据应答）：
 *   复核 class 与全部 token 计算值与首帧一致，且无横向溢出。
 *
 * 语义关系断言（不锁定具体色值）：
 * - 公开方言（.dialect-public）的主要动作色 --primary 必须解析为品牌强调色
 *   （== --brand，且明显有彩度），引言竖线与 text-primary 元素跟随该 scoped accent；
 * - 根作用域保持高对比中性动作色且 --brand 未被页面 scope 泄漏改写；
 * - --destructive 在根与公开方言作用域完全一致（palette 不改写行为状态色）。
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type BrowserContext, expect, type Page, type Route, test } from "@playwright/test";
import { handle } from "./mock-data.mjs";

const THEME_SERVER_PORT = 4173;
const CLIENT_DIR = join(import.meta.dirname, "..", "dist", "client");

const VIEWPORTS = [
	{ name: "mobile", width: 390, height: 844 },
	{ name: "desktop", width: 1440, height: 900 },
] as const;

type ThemeMode = "light" | "dark" | "system";
const THEMES: ThemeMode[] = ["light", "dark", "system"];

/** 主题模式 → cookie 持久化值（SSR 读 cookie 定 <html> 首帧 class）。 */
const THEME_COOKIE: Record<ThemeMode, string | null> = {
	light: "light",
	dark: "dark",
	system: null,
};

/** 主题模式 → next-themes localStorage 值（hydration 后 class 不得翻转）。 */
const THEME_STORAGE: Record<ThemeMode, string | null> = {
	light: "light",
	dark: "dark",
	system: null,
};

interface Oklch {
	l: number;
	c: number;
	h: number;
}

/**
 * parseOklch - 解析 computed style 输出的 oklch 颜色串。
 *
 * @example parseOklch("oklch(62.5% .19 25)") // { l: 0.625, c: 0.19, h: 25 }
 */
function parseOklch(value: string): Oklch | null {
	const match = value.match(/^oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/);
	if (!match) return null;
	const [, l, c, h] = match;
	const percent = value.includes("%");
	return {
		l: Number(l) / (percent ? 100 : 1),
		c: Number(c),
		h: Number(h),
	};
}

/**
 * parseOklabChroma - 解析 oklab 串的彩度（a、b 的模长）与 alpha。
 *
 * color-mix(in oklab, …) 的 computed value 以 oklab 串输出，
 * 例如 "oklab(0.625 0.172 0.08 / 0.4)"。
 */
function parseOklabChroma(value: string): { chroma: number; alpha: number } | null {
	const match = value.match(
		/^oklab\(\s*[\d.]+%?\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s*\/\s*([\d.]+))?\)/,
	);
	if (!match) return null;
	const a = Number(match[1]);
	const b = Number(match[2]);
	return { chroma: Math.hypot(a, b), alpha: match[3] ? Number(match[3]) : 1 };
}

/** 在页面内读取一批与主题契约相关的计算值（token 字符串与解析后的颜色）。 */
async function snapshotTheme(page: Page) {
	return page.evaluate(() => {
		const cs = (el: Element) => getComputedStyle(el);
		const surface = document.querySelector(".dialect-public");
		if (!surface) throw new Error("页面缺少 .dialect-public 作用域容器");
		const epigraph = surface.querySelector('[aria-label="卷首引言"]');
		const textPrimary = surface.querySelector(".text-primary");
		const prop = (el: Element, name: string) => cs(el).getPropertyValue(name).trim();
		return {
			htmlClass: document.documentElement.className,
			rootPrimary: prop(document.documentElement, "--primary"),
			rootBrand: prop(document.documentElement, "--brand"),
			rootDestructive: prop(document.documentElement, "--destructive"),
			rootBackground: prop(document.documentElement, "--background"),
			surfacePrimary: prop(surface, "--primary"),
			surfaceBrand: prop(surface, "--brand"),
			surfaceDestructive: prop(surface, "--destructive"),
			surfaceBackground: prop(surface, "--background"),
			epigraphBorder: epigraph ? cs(epigraph).borderLeftColor : null,
			textPrimaryColor: textPrimary ? cs(textPrimary).color : null,
			scrollWidth: document.documentElement.scrollWidth,
			innerWidth: window.innerWidth,
		};
	});
}

/** 按主题模式准备 context：cookie（SSR 首帧）+ localStorage（next-themes）。 */
async function newThemeContext(browser: import("@playwright/test").Browser, theme: ThemeMode) {
	const context = await browser.newContext();
	const cookie = THEME_COOKIE[theme];
	if (cookie) {
		await context.addCookies([
			{ name: "theme", value: cookie, url: `http://127.0.0.1:${THEME_SERVER_PORT}` },
		]);
	}
	const storage = THEME_STORAGE[theme];
	if (storage) {
		await context.addInitScript(
			([value]) => {
				localStorage.setItem("theme", value);
			},
			[storage] satisfies [string],
		);
	}
	return context;
}

/** 拦截静态资源（node 产物只做 SSR，不伺服 dist/client）与浏览器侧 API。 */
async function routeClient(context: BrowserContext, options?: { blockScripts: boolean }) {
	await context.route("**/*", (route: Route) => {
		const request = route.request();
		const type = request.resourceType();
		if (options?.blockScripts && (type === "script" || type === "fetch" || type === "xhr")) {
			return route.abort();
		}
		const url = new URL(request.url());
		if (url.pathname.startsWith("/api/")) {
			const result = handle(request.method(), url.pathname, url.search);
			return route.fulfill({
				status: result.status,
				contentType: "application/json",
				body: result.body,
			});
		}
		if (url.pathname.startsWith("/assets/")) {
			const file = join(CLIENT_DIR, url.pathname);
			if (existsSync(file) && !file.endsWith("/")) {
				const contentType = url.pathname.endsWith(".css")
					? "text/css; charset=utf-8"
					: url.pathname.endsWith(".woff2")
						? "font/woff2"
						: "application/javascript";
				return route.fulfill({ status: 200, contentType, body: readFileSync(file) });
			}
			return route.abort();
		}
		return route.continue();
	});
}

/** 断言一组主题快照满足公开方言的语义关系。 */
function expectDialectSemantics(snapshot: Awaited<ReturnType<typeof snapshotTheme>>) {
	const resolvedTheme = snapshot.htmlClass.includes("dark") ? "dark" : "light";

	const rootPrimary = parseOklch(snapshot.rootPrimary);
	const surfacePrimary = parseOklch(snapshot.surfacePrimary);
	const rootDestructive = parseOklch(snapshot.rootDestructive);
	const surfaceDestructive = parseOklch(snapshot.surfaceDestructive);
	const rootBackground = parseOklch(snapshot.rootBackground);
	expect(rootPrimary, "根作用域 --primary 应为可解析颜色").not.toBeNull();
	expect(surfacePrimary, "公开方言 --primary 应为可解析颜色").not.toBeNull();

	// 根作用域：高对比中性主要动作色（工具方言默认形态），且彩度不为 scoped accent 污染
	expect(
		rootPrimary!.c,
		`根作用域主要动作色应为中性，实际 ${snapshot.rootPrimary}`,
	).toBeLessThanOrEqual(0.01);
	const extreme = Math.abs(rootPrimary!.l - 0.5);
	expect(extreme, "根作用域主要动作色应为高对比（明度远离中灰）").toBeGreaterThan(0.25);
	// 根作用域 --brand 保持 palette 原彩度：页面 scope 未向上泄漏改写全局 token
	const rootBrand = parseOklch(snapshot.rootBrand);
	expect(rootBrand, "根作用域 --brand 应为可解析颜色").not.toBeNull();
	expect(
		rootBrand!.c,
		`根作用域品牌强调色不应被页面 scope 泄漏改写，实际 ${snapshot.rootBrand}`,
	).toBeGreaterThan(0.05);

	// 公开方言：主要动作 == 品牌强调，且有明显彩度（捕获「提前求值退化为黑白」类回归）
	expect(snapshot.surfacePrimary, "公开方言主要动作色应映射到品牌强调色").toBe(
		snapshot.surfaceBrand,
	);
	expect(
		surfacePrimary!.c,
		`公开方言主要动作色应有彩度，实际 ${snapshot.surfacePrimary}`,
	).toBeGreaterThan(0.05);

	// 行为状态色不受方言与 palette 改写
	expect(surfaceDestructive, "destructive 应为可解析颜色").not.toBeNull();
	expect(snapshot.surfaceDestructive, "destructive 在方言作用域不得被改写").toBe(
		snapshot.rootDestructive,
	);
	expect(rootDestructive!.c).toBeGreaterThan(0.05);

	// 画布跟随主题：浅色近白、深色近黑
	expect(rootBackground, "画布 token 应为可解析颜色").not.toBeNull();
	if (resolvedTheme === "light") {
		expect(rootBackground!.l).toBeGreaterThan(0.9);
	} else {
		expect(rootBackground!.l).toBeLessThan(0.3);
	}
}

for (const viewport of VIEWPORTS) {
	for (const theme of THEMES) {
		test(`首页主题契约：${theme} @ ${viewport.width}×${viewport.height}`, async ({
			browser,
		}) => {
			test.setTimeout(90_000);

			// —— 首帧：阻断 JS bundle，SSR HTML + 内联主题脚本先渲染 ——
			const firstFrameContext = await newThemeContext(browser, theme);
			if (theme === "system") {
			}
			await routeClient(firstFrameContext, { blockScripts: true });
			const firstPage = await firstFrameContext.newPage();
			if (theme === "system") {
				await firstPage.emulateMedia({ colorScheme: "dark" });
			}
			await firstPage.setViewportSize(viewport);
			await firstPage.goto("/", { waitUntil: "load" });
			await expect(
				firstPage.locator(".dialect-public"),
				"SSR 首帧应渲染公开方言容器",
			).toBeVisible();

			const firstFrame = await snapshotTheme(firstPage);
			const firstFrameTheme = firstFrame.htmlClass.includes("dark") ? "dark" : "light";
			if (theme !== "system") {
				expect(firstFrameTheme, "SSR 首帧 <html> class 应与主题一致").toBe(theme);
			} else {
				// system：跟随系统解析（emulateMedia dark），首帧即正确、不得闪浅色
				expect(firstFrameTheme, "system 模式首帧应解析为系统外观").toBe("dark");
			}
			expectDialectSemantics(firstFrame);

			// 引言竖线：color-mix 解析结果应有彩度且非全透明，跟随 scoped accent
			const firstBorder = firstFrame.epigraphBorder;
			expect(firstBorder, "卷首引言竖线应存在").toBeTruthy();
			const firstBorderParsed = parseOklabChroma(firstBorder!);
			expect(
				firstBorderParsed,
				`竖线颜色应为可解析混合色，实际 ${firstBorder}`,
			).not.toBeNull();
			expect(firstBorderParsed!.alpha).toBeGreaterThan(0.1);
			expect(
				firstBorderParsed!.chroma,
				`竖线应有彩度（scoped accent），实际 ${firstBorder}`,
			).toBeGreaterThan(0.05);
			if (firstFrame.textPrimaryColor) {
				expect(
					parseOklch(firstFrame.textPrimaryColor)?.c,
					"text-primary 元素应解析为 scoped accent",
				).toBeGreaterThan(0.05);
			}
			// 无横向溢出（hydration 前）
			expect(firstFrame.scrollWidth).toBeLessThanOrEqual(firstFrame.innerWidth);
			await firstFrameContext.close();

			// —— hydration 后：放行 JS，浏览器侧 API 由 mock 应答 ——
			const hydratedContext = await newThemeContext(browser, theme);
			if (theme === "system") {
			}
			await routeClient(hydratedContext);
			const page = await hydratedContext.newPage();
			if (theme === "system") {
				await page.emulateMedia({ colorScheme: "dark" });
			}
			await page.setViewportSize(viewport);
			await page.goto("/", { waitUntil: "load" });
			await page.waitForLoadState("networkidle");

			const hydrated = await snapshotTheme(page);
			const hydratedTheme = hydrated.htmlClass.includes("dark") ? "dark" : "light";
			expect(hydratedTheme, "hydration 后主题不得翻转").toBe(firstFrameTheme);
			expectDialectSemantics(hydrated);
			// hydration 前后主题相关 token 必须逐项一致（首帧无闪色）
			expect(hydrated.surfacePrimary, "scoped accent hydration 前后一致").toBe(
				firstFrame.surfacePrimary,
			);
			expect(hydrated.rootBackground, "画布 token hydration 前后一致").toBe(
				firstFrame.rootBackground,
			);
			expect(hydrated.epigraphBorder, "引言竖线 hydration 前后一致").toBe(
				firstFrame.epigraphBorder,
			);
			// 无横向溢出（hydration 后）
			expect(hydrated.scrollWidth).toBeLessThanOrEqual(hydrated.innerWidth);
			await hydratedContext.close();
		});
	}
}
