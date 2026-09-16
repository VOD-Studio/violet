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

/** 沉浸方言契约图集用的 1×1 PNG（经 /assets 路径应答，避免真实网络图源）。 */
const CONTRACT_IMAGE_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
	"base64",
);

const VIEWPORTS = [
	{ name: "mobile", width: 390, height: 844 },
	{ name: "desktop", width: 1440, height: 900 },
] as const;

type ThemeMode = "light" | "dark" | "system";
const THEMES: ThemeMode[] = ["light", "dark", "system"];

/**
 * 主题模式的持久化偏好：cookie 供 SSR 定 <html> 首帧 class，
 * localStorage 供 next-themes 在 hydration 后保持同一主题（缺一会翻转）。
 * system 两者皆无，由系统外观经内联脚本解析。
 */
const THEME_PREFERENCE: Record<ThemeMode, { cookie: string | null; storage: string | null }> = {
	light: { cookie: "light", storage: "light" },
	dark: { cookie: "dark", storage: "dark" },
	system: { cookie: null, storage: null },
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

/**
 * expectColor - 断言值为可解析的 oklch 颜色并返回解析结果，供后续彩度/明度断言使用。
 */
function expectColor(value: string, label: string): Oklch {
	const parsed = parseOklch(value);
	if (!parsed) throw new Error(`${label}应为可解析 oklch 颜色，实际 ${value}`);
	return parsed;
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
	const { cookie, storage } = THEME_PREFERENCE[theme];
	if (cookie) {
		await context.addCookies([
			{ name: "theme", value: cookie, url: `http://127.0.0.1:${THEME_SERVER_PORT}` },
		]);
	}
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
			const result = handle(
				request.method(),
				url.pathname,
				url.search,
				request.headers().cookie ?? "",
			);
			return route.fulfill({
				status: result.status,
				contentType: "application/json",
				body: result.body,
			});
		}
		if (url.pathname.startsWith("/assets/")) {
			if (url.pathname === "/assets/contract-image.png") {
				return route.fulfill({
					status: 200,
					contentType: "image/png",
					body: CONTRACT_IMAGE_PNG,
				});
			}
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

	const rootPrimary = expectColor(snapshot.rootPrimary, "根作用域 --primary");
	const surfacePrimary = expectColor(snapshot.surfacePrimary, "公开方言 --primary");
	const rootDestructive = expectColor(snapshot.rootDestructive, "根作用域 --destructive");
	expectColor(snapshot.surfaceDestructive, "方言作用域 --destructive");
	const rootBrand = expectColor(snapshot.rootBrand, "根作用域 --brand");
	const rootBackground = expectColor(snapshot.rootBackground, "画布 --background");

	// 根作用域：高对比中性主要动作色（工具方言默认形态），且彩度不为 scoped accent 污染
	expect(
		rootPrimary.c,
		`根作用域主要动作色应为中性，实际 ${snapshot.rootPrimary}`,
	).toBeLessThanOrEqual(0.01);
	// 高对比 = 明度远离中灰；0.25 排除中间调，只剩近黑（light）/近白（dark）
	const extreme = Math.abs(rootPrimary.l - 0.5);
	expect(extreme, "根作用域主要动作色应为高对比（明度远离中灰）").toBeGreaterThan(0.25);
	// 根作用域 --brand 保持 palette 原彩度：页面 scope 未向上泄漏改写全局 token
	expect(
		rootBrand.c,
		`根作用域品牌强调色不应被页面 scope 泄漏改写，实际 ${snapshot.rootBrand}`,
	).toBeGreaterThan(0.05);

	// 公开方言：主要动作 == 品牌强调，且有明显彩度（捕获「提前求值退化为黑白」类回归）
	expect(snapshot.surfacePrimary, "公开方言主要动作色应映射到品牌强调色").toBe(
		snapshot.surfaceBrand,
	);
	expect(
		surfacePrimary.c,
		`公开方言主要动作色应有彩度，实际 ${snapshot.surfacePrimary}`,
	).toBeGreaterThan(0.05);

	// 行为状态色不受方言与 palette 改写：destructive 全局同一色值且保持危险彩度
	expect(snapshot.surfaceDestructive, "destructive 在方言作用域不得被改写").toBe(
		snapshot.rootDestructive,
	);
	expect(rootDestructive.c).toBeGreaterThan(0.05);

	// 画布跟随主题：浅色近白、深色近黑
	if (resolvedTheme === "light") {
		expect(rootBackground.l).toBeGreaterThan(0.9);
	} else {
		expect(rootBackground.l).toBeLessThan(0.3);
	}
}

for (const theme of ["light", "dark"] as const) {
	test(`沉浸方言契约：图库灯箱 ${theme}`, async ({ browser }) => {
		test.setTimeout(90_000);
		const context = await newThemeContext(browser, theme);
		await routeClient(context);
		const page = await context.newPage();
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto("/galleries", { waitUntil: "load" });
		await page.waitForLoadState("networkidle");

		// 进入图集详情并打开灯箱（Immersive 作用域挂在灯箱根容器）
		await page.locator('a[href="/galleries/contract-gallery"]').first().click();
		await page.waitForURL("**/galleries/contract-gallery");
		await page.waitForLoadState("networkidle");
		await page.locator("figure button").first().click();
		const immersive = page.locator(".dialect-immersive");
		await expect(immersive, "灯箱应挂 Immersive 方言作用域").toBeVisible();

		const stage = await page.evaluate(() => {
			const scope = document.querySelector(".dialect-immersive");
			if (!scope) throw new Error("灯箱未挂 .dialect-immersive 作用域");
			const cs = getComputedStyle(scope);
			const root = getComputedStyle(document.documentElement);
			const prop = (el: CSSStyleDeclaration, name: string) =>
				el.getPropertyValue(name).trim();
			return {
				background: prop(cs, "--background"),
				primary: prop(cs, "--primary"),
				ring: prop(cs, "--ring"),
				destructive: prop(cs, "--destructive"),
				rootBrand: prop(root, "--brand"),
				rootDestructive: prop(root, "--destructive"),
				scopeBackground: cs.backgroundColor,
			};
		});

		// 画布：中性舞台恒近黑，不随明暗主题翻转；实际底色消费画布 token
		// （computed 串与原始 token 串的百分比写法可能不同，按解析后的色值比较）
		const background = expectColor(stage.background, "沉浸画布 --background");
		expect(background.l, "沉浸画布应为近黑舞台").toBeLessThan(0.3);
		expect(background.c, "沉浸画布应为中性（无彩度）").toBeLessThanOrEqual(0.01);
		const scopeBackground = expectColor(stage.scopeBackground, "舞台实际底色");
		expect(scopeBackground.l, "舞台底色明度应等于画布 token").toBe(background.l);
		expect(scopeBackground.c, "舞台底色彩度应等于画布 token").toBe(background.c);

		// 控制：主要动作色从品牌强调收回高对比中性（覆盖公开方言的品牌映射）
		const primary = expectColor(stage.primary, "沉浸主要动作色");
		expect(primary.c, "沉浸主要动作色应为中性").toBeLessThanOrEqual(0.01);
		expect(Math.abs(primary.l - 0.5), "沉浸主要动作色应为高对比").toBeGreaterThan(0.25);

		// 焦点：焦点环保留品牌彩度（媒体舞台内品牌唯一容身之处）
		const ring = expectColor(stage.ring, "沉浸焦点环");
		expect(ring.c, "沉浸焦点环应保留品牌彩度").toBeGreaterThan(0.05);
		expect(stage.ring, "沉浸焦点环应等于品牌强调色").toBe(stage.rootBrand);

		// 行为状态色不被方言改写
		expect(stage.destructive, "destructive 在沉浸作用域不得被改写").toBe(stage.rootDestructive);

		// 关闭灯箱：作用域卸载后无 token 泄漏（页面公开方言语义复原）
		await immersive.click({ position: { x: 12, y: 500 } });
		await expect(immersive).toHaveCount(0);
		const afterClose = await page.evaluate(() => {
			const surface = document.querySelector(".dialect-public");
			if (!surface) throw new Error("关闭灯箱后缺少 .dialect-public 作用域");
			const cs = getComputedStyle(surface);
			const root = getComputedStyle(document.documentElement);
			return {
				surfacePrimary: cs.getPropertyValue("--primary").trim(),
				surfaceBrand: cs.getPropertyValue("--brand").trim(),
				rootBrand: root.getPropertyValue("--brand").trim(),
			};
		});
		expect(afterClose.surfacePrimary, "公开方言主要动作色应回到品牌强调").toBe(
			afterClose.surfaceBrand,
		);
		expect(afterClose.rootBrand, "根作用域 --brand 不被沉浸作用域泄漏改写").toBe(
			stage.rootBrand,
		);
		await context.close();
	});
}

/**
 * 后台工具方言契约：契约管理员 cookie（contract_admin=1）使 mock 会话按 root
 * 应答（SSR server function 与客户端 RPC 同源转发 cookie，两端登录态一致）。
 */
async function newAdminContext(browser: import("@playwright/test").Browser, theme: ThemeMode) {
	const context = await browser.newContext();
	const cookies: {
		name: string;
		value: string;
		url: string;
	}[] = [{ name: "contract_admin", value: "1", url: `http://127.0.0.1:${THEME_SERVER_PORT}` }];
	const { cookie } = THEME_PREFERENCE[theme];
	if (cookie) {
		cookies.push({
			name: "theme",
			value: cookie,
			url: `http://127.0.0.1:${THEME_SERVER_PORT}`,
		});
	}
	await context.addCookies(cookies);
	const { storage } = THEME_PREFERENCE[theme];
	if (storage) {
		await context.addInitScript(
			([value]) => {
				localStorage.setItem("theme", value);
			},
			[storage] satisfies [string],
		);
	}
	await routeClient(context);
	return context;
}

for (const viewport of VIEWPORTS) {
	for (const theme of ["light", "dark"] as const) {
		test(`工具方言契约：后台壳层 ${theme} @ ${viewport.width}×${viewport.height}`, async ({
			browser,
		}) => {
			test.setTimeout(90_000);
			// /admin 为 ssr:false 客户端渲染：主题由 beforeLoad 读 cookie 决定，
			// 契约验证 hydration 后壳层 token、当前导航品牌指示与溢出
			const context = await newAdminContext(browser, theme);
			const page = await context.newPage();
			await page.setViewportSize(viewport);
			await page.goto("/admin", { waitUntil: "load" });
			await page.waitForLoadState("networkidle");
			await expect(
				page.locator(".dialect-tool"),
				"后台壳层应挂 Tool 方言作用域",
			).toBeVisible();

			const snapshot = await page.evaluate(() => {
				const scope = document.querySelector(".dialect-tool");
				if (!scope) throw new Error("后台壳层缺少 .dialect-tool 作用域");
				const cs = getComputedStyle(scope);
				const root = getComputedStyle(document.documentElement);
				const prop = (el: CSSStyleDeclaration, name: string) =>
					el.getPropertyValue(name).trim();
				const activeLink = document.querySelector('a[aria-current="page"]');
				return {
					htmlClass: document.documentElement.className,
					primary: prop(cs, "--primary"),
					ring: prop(cs, "--ring"),
					destructive: prop(cs, "--destructive"),
					background: prop(cs, "--background"),
					rootPrimary: prop(root, "--primary"),
					rootBrand: prop(root, "--brand"),
					rootDestructive: prop(root, "--destructive"),
					activeIndicator: activeLink
						? getComputedStyle(activeLink, "::before").backgroundColor
						: null,
					scrollWidth: document.documentElement.scrollWidth,
					innerWidth: window.innerWidth,
				};
			});

			// 主要动作：工具方言 == 基础层默认高对比中性，与根作用域一致
			expect(snapshot.primary, "工具方言主要动作色应为根作用域默认").toBe(
				snapshot.rootPrimary,
			);
			const primary = expectColor(snapshot.primary, "工具方言主要动作色");
			expect(primary.c, "后台 default action 应为中性色").toBeLessThanOrEqual(0.01);
			expect(Math.abs(primary.l - 0.5), "后台 default action 应为高对比").toBeGreaterThan(
				0.25,
			);

			// 焦点/当前导航：品牌强调（工具方言下品牌唯一露出点）
			expect(snapshot.ring, "工具方言焦点环应映射品牌强调色").toBe(snapshot.rootBrand);
			// 移动端视口可能命中的是移动导航项（无 before 指示条，底色透明）——仅对实际有色的指示条断言
			const indicatorRaw = snapshot.activeIndicator ?? "";
			const indicatorChroma =
				parseOklch(indicatorRaw)?.c ?? parseOklabChroma(indicatorRaw)?.chroma ?? null;
			if (indicatorChroma !== null) {
				expect(
					indicatorChroma,
					`当前导航指示条应使用品牌强调色，实际 ${indicatorRaw}`,
				).toBeGreaterThan(0.05);
			} else if (indicatorRaw && indicatorRaw !== "rgba(0, 0, 0, 0)") {
				throw new Error(`当前导航指示条颜色不可解析: ${indicatorRaw}`);
			}

			// 行为状态色不被改写；画布随主题；无横向溢出
			expect(snapshot.destructive, "destructive 在工具方言不得被改写").toBe(
				snapshot.rootDestructive,
			);
			const background = expectColor(snapshot.background, "工具方言画布");
			if (theme === "light") {
				expect(background.l, "浅色后台画布应近白").toBeGreaterThan(0.9);
			} else {
				expect(background.l, "深色后台画布应近黑").toBeLessThan(0.3);
			}
			expect(snapshot.scrollWidth).toBeLessThanOrEqual(snapshot.innerWidth);
			await context.close();
		});
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
			const firstBorderParsed = parseOklabChroma(firstBorder ?? "");
			if (!firstBorderParsed)
				throw new Error(`竖线颜色应为可解析混合色，实际 ${firstBorder}`);
			expect(firstBorderParsed.alpha).toBeGreaterThan(0.1);
			expect(
				firstBorderParsed.chroma,
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
