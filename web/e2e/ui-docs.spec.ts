import { existsSync } from "node:fs";
import { join } from "node:path";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";

const CLIENT_DIR = join(import.meta.dirname, "..", "dist", "client");

async function loadClient(context: BrowserContext) {
	// 生产 SSR 入口不伺服静态文件；直接加载本次构建产物，文档 HTML 仍由真实路由应答。
	await context.route("**/assets/**", async (route) => {
		const path = join(CLIENT_DIR, new URL(route.request().url()).pathname);
		if (existsSync(path)) await route.fulfill({ path });
		else await route.continue();
	});
	await context.route("**/api/**", async (route) => {
		const url = new URL(route.request().url());
		const response = await route.fetch({
			url: `http://127.0.0.1:9410${url.pathname}${url.search}`,
		});
		await route.fulfill({ response });
	});
}

function collectDiagnostics(page: Page) {
	const diagnostics: string[] = [];
	page.on("pageerror", (error) => diagnostics.push(error.message));
	page.on("console", (message) => {
		const text = message.text();
		const source = message.location().url;
		// 匿名身份探活返回 401；只排除该响应的浏览器资源提示。
		if (
			message.type() === "error" &&
			source === "http://127.0.0.1:4173/api/v1/auth/me" &&
			text ===
				"Failed to load resource: the server responded with a status of 401 (Unauthorized)"
		) {
			return;
		}
		if (
			message.type() === "error" ||
			/same key|duplicate key|hydration|hydrated|uncaught/i.test(text)
		) {
			diagnostics.push(`${source}: ${text}`);
		}
	});
	return diagnostics;
}

async function expectNoOverflow(page: Page) {
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
					window.innerWidth,
			),
		)
		.toBeLessThanOrEqual(0);
}

test("组件库文档提供独立导航和可运行的组件示例", async ({ page, context }, testInfo) => {
	await loadClient(context);
	const diagnostics = collectDiagnostics(page);
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto("/ui");
	await expect(page).toHaveURL(/\/ui\/guides\/introduction$/);
	await expect(page.getByRole("heading", { level: 1, name: "介绍" })).toBeVisible();
	await page.waitForLoadState("networkidle");
	const navigation = page.getByRole("navigation", { name: "组件库文档目录" });
	await expect(navigation).toBeVisible();
	await expect(navigation.getByText(/^@?violet\/ui$/i)).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath("ui-docs-desktop.png"), fullPage: true });
	await navigation.getByRole("link", { name: "组件目录", exact: true }).click();
	await expect(page).toHaveURL(/\/ui\/components\/?$/);
	await expect(page.getByRole("heading", { level: 1, name: "组件", exact: true })).toBeVisible();
	await page.screenshot({
		path: testInfo.outputPath("ui-components-desktop.png"),
		fullPage: true,
	});
	await page.locator('article a[href="/ui/components/button"]').click();
	await expect(page.getByRole("heading", { level: 1, name: "Button 按钮" })).toBeVisible();
	await page.getByRole("button", { name: "已点击 0 次", exact: true }).click();
	const button = page.getByRole("button", { name: "已点击 1 次", exact: true });
	await expect(button).toBeVisible();
	const buttonExample = page.locator("[data-toc-ignore]").filter({ has: button });
	await buttonExample.getByRole("button", { name: "展开代码", exact: true }).click();
	const buttonCodeToggle = buttonExample.getByRole("button", {
		name: /^(展开|收起)代码$/,
	});
	await expect(buttonCodeToggle).toHaveAttribute("aria-expanded", "true");
	await buttonCodeToggle.click();
	await expect(buttonCodeToggle).toHaveAttribute("aria-expanded", "false");
	await navigation.getByRole("link", { name: "组件目录", exact: true }).click();
	await page.locator('article a[href="/ui/components/checkbox"]').click();
	await expect(
		page.getByRole("heading", { level: 1, name: "Checkbox", exact: true }),
	).toBeVisible();
	const checkbox = page.getByRole("checkbox", { name: /已阅读并同意服务协议/ });
	await expect(checkbox).not.toBeChecked();
	await checkbox.press("Space");
	await expect(checkbox).toBeChecked();
	const checkboxExample = page.locator("[data-toc-ignore]").filter({ has: checkbox });
	await checkboxExample.getByRole("button", { name: "展开代码", exact: true }).click();
	const checkboxCodeToggle = checkboxExample.getByRole("button", {
		name: /^(展开|收起)代码$/,
	});
	await expect(checkboxCodeToggle).toHaveAttribute("aria-expanded", "true");
	await checkboxCodeToggle.click();
	await expect(checkboxCodeToggle).toHaveAttribute("aria-expanded", "false");
	await page.waitForLoadState("networkidle");
	expect(diagnostics).toEqual([]);
});

test("旧设计系统根路径和章节已下线", async ({ request }) => {
	const removedPaths = [
		"/design-system",
		"/design-system/",
		"/design-system/guides/introduction",
		"/design-system/principles",
		"/design-system/decisions",
		"/design-system/palette",
		"/design-system/tokens",
		"/design-system/layout",
		"/design-system/motion",
		"/design-system/specimens",
		"/design-system/specimens/button",
		"/design-system/specimens/badge",
		"/design-system/specimens/checkbox",
		"/design-system/specimens/dialog",
		"/design-system/specimens/tabs",
		"/design-system/specimens/input",
		"/design-system/specimens/text-field",
		"/design-system/specimens/comment-section",
		"/design-system/specimens/cartoon-popover",
	];
	for (const path of removedPaths) {
		let response = await request.get(path, { maxRedirects: 0 });
		if (path.endsWith("/") && response.status() === 307) {
			const canonical = path.slice(0, -1);
			expect(response.headers().location, path).toBe(canonical);
			response = await request.get(canonical, { maxRedirects: 0 });
		}
		expect(response.status(), path).toBe(404);
	}
});

test("窄屏减弱动态下文档目录支持键盘和导航关闭", async ({ page, context }, testInfo) => {
	await loadClient(context);
	const diagnostics = collectDiagnostics(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.goto("/ui");
	await expect(page).toHaveURL(/\/ui\/guides\/introduction$/);
	await page.waitForLoadState("networkidle");
	const directory = page
		.locator("details")
		.filter({ has: page.locator("summary", { hasText: /^目录/ }) });
	const summary = directory.locator("summary");
	await expect(summary).toBeVisible();
	await expect(directory).not.toHaveAttribute("open", "");
	await expectNoOverflow(page);
	await summary.focus();
	await summary.press("Enter");
	await expect(directory).toHaveAttribute("open", "");
	await expect(directory.getByRole("navigation", { name: "组件库文档目录" })).toBeVisible();
	await expectNoOverflow(page);
	await page.screenshot({
		path: testInfo.outputPath("ui-docs-mobile-directory.png"),
		fullPage: true,
	});
	await summary.press("Space");
	await expect(directory).not.toHaveAttribute("open", "");
	await summary.press("Enter");
	const introduction = directory.getByRole("link", { name: "介绍", exact: true });
	await introduction.focus();
	await introduction.press("Escape");
	await expect(directory).not.toHaveAttribute("open", "");
	await expect(summary).toBeFocused();
	await summary.press("Enter");
	await directory.getByRole("link", { name: "快速入门", exact: true }).click();
	await expect(page).toHaveURL(/\/ui\/guides\/quick-start$/);
	await expect(page.getByRole("heading", { level: 1, name: "快速入门" })).toBeVisible();
	await expect(directory).not.toHaveAttribute("open", "");
	await expectNoOverflow(page);
	await page.waitForLoadState("networkidle");
	expect(diagnostics).toEqual([]);
});
